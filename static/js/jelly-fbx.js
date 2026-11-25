import * as THREE from '../vendor/three.module.min.js';
import { FBXLoader } from '../vendor/loaders/FBXLoader.js';
import { mergeGeometries, mergeVertices } from '../vendor/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from '../vendor/meshopt_simplifier.module.js';

// The FBX exports 30 meshes in a flat group. s0008 is the outer bell;
// its rim sets the origin so the imported model follows the original trajectory.
function prepareMeshes(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  const bell = meshes.find((mesh) => mesh.name === 's0008');
  if (!bell || meshes.length !== 30) throw new Error('Unexpected jellyfish FBX hierarchy');

  const up = new THREE.Vector3(0, .85, -.52).normalize();
  const rotation = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0)),
  );
  const shell = bell.geometry.applyMatrix4(bell.matrixWorld).applyMatrix4(rotation);
  shell.computeBoundingBox();
  const center = shell.boundingBox.getCenter(new THREE.Vector3());
  center.y = shell.boundingBox.min.y;
  const size = shell.boundingBox.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.z);
  const normalize = new THREE.Matrix4().makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  shell.applyMatrix4(normalize);
  const transform = normalize.clone().multiply(rotation);
  const details = meshes.filter((mesh) => mesh !== bell).map((mesh) =>
    mesh.geometry.applyMatrix4(transform.clone().multiply(mesh.matrixWorld)));
  return { shell, details, meshes };
}

function simplify(geometry, ratio) {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', geometry.attributes.position);
  const welded = mergeVertices(source, .0001);
  const positions = welded.attributes.position;
  const indices = Uint32Array.from(welded.index.array);
  const target = Math.max(3, Math.floor(indices.length * ratio / 3) * 3);
  const [reduced] = MeshoptSimplifier.simplify(indices, positions.array, 3, target, .04);
  const [remap, count] = MeshoptSimplifier.compactMesh(reduced);
  const packed = new Float32Array(count * 3);
  for (let i = 0; i < remap.length; i++) {
    const vertex = remap[i];
    if (vertex >= count) continue;
    packed.set(positions.array.subarray(i * 3, i * 3 + 3), vertex * 3);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(packed, 3));
  result.setIndex(new THREE.BufferAttribute(count < 65536 ? Uint16Array.from(reduced) : reduced, 1));
  result.computeVertexNormals();
  return result;
}

function deform(material, motion) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, motion);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      uniform float jellyTime;
      uniform float jellySteer;
      void jellyMotion(vec3 p, out vec3 moved, out vec3 vertical, out float radial) {
        float phase = 0.;
        #ifdef USE_INSTANCING
          phase = instanceMatrix[3].z * 1.7;
        #endif
        float pulse = .5 - .5 * cos(jellyTime * 2.1 + phase);
        float bell = smoothstep(-1.1, .18, p.y);
        float u = clamp((p.y + 1.1) / 1.28, 0., 1.);
        float slope = 6. * u * (1. - u) / 1.28;
        float lengthDown = max(-p.y, 0.);
        float weight = lengthDown * lengthDown / (1. + lengthDown);
        float weightSlope = -lengthDown * (2. + lengthDown) / pow(1. + lengthDown, 2.);
        float wave = jellyTime * 1.8 + p.y * 3.4 + phase;
        vec2 sway = vec2(.13 * sin(wave) + jellySteer * .075, .10 * cos(wave * .81));
        vec2 swaySlope = vec2(.442 * cos(wave), -.2754 * sin(wave * .81));
        radial = 1. - .15 * pulse * bell;
        moved = p;
        moved.xz = p.xz * radial + sway * weight;
        moved.y = p.y * (1. + .21 * pulse * bell);
        vec2 bend = -.15 * pulse * slope * p.xz + sway * weightSlope + swaySlope * weight;
        vertical = vec3(bend.x, 1. + .21 * pulse * (bell + p.y * slope), bend.y);
      }
    `).replace('#include <beginnormal_vertex>', `
      vec3 jellyPosition;
      vec3 jellyVertical;
      float jellyRadial;
      jellyMotion(position, jellyPosition, jellyVertical, jellyRadial);
      #include <beginnormal_vertex>
      objectNormal.xz /= jellyRadial;
      objectNormal.y = (objectNormal.y - dot(objectNormal.xz, jellyVertical.xz)) / jellyVertical.y;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed = jellyPosition;
    `);
  };
  return material;
}

export async function loadJellyfish(quality) {
  const url = new URL('../models/jellyfish.fbx', import.meta.url);
  const root = await new FBXLoader().loadAsync(url.href);
  const { shell, details, meshes } = prepareMeshes(root);
  const detailGeometry = mergeGeometries(details);
  if (!detailGeometry) throw new Error('Incompatible jellyfish FBX vertex attributes');
  if (MeshoptSimplifier.supported) await MeshoptSimplifier.ready;

  // Simplify each mesh independently so small anatomical features survive.
  const ratio = quality.compact ? .012 : .022;
  const distantShell = MeshoptSimplifier.supported ? simplify(shell, .024) : shell;
  const distantDetails = MeshoptSimplifier.supported
    ? mergeGeometries(details.map((geometry) => simplify(geometry, ratio)))
    : detailGeometry;
  for (const geometry of new Set([shell, detailGeometry, distantShell, distantDetails])) {
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += .65;
  }
  details.forEach((geometry) => geometry.dispose());
  new Set(meshes.map((mesh) => mesh.material)).forEach((material) => material.dispose());

  const motion = { jellyTime: { value: 0 }, jellySteer: { value: 0 } };
  const physical = (properties) => deform(new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide, forceSinglePass: true, transparent: true, depthWrite: false,
    roughness: .22, ior: 1.34, clearcoat: .42, iridescence: .85, iridescenceIOR: 1.35,
    iridescenceThicknessRange: [220, 420], ...properties,
  }), motion);
  const main = new THREE.Group();
  const tissue = new THREE.Mesh(detailGeometry, physical({
    color: 0xa3aff6, opacity: .37, emissive: 0x6357b1, emissiveIntensity: .36,
  }));
  const mantle = new THREE.Mesh(shell, physical({
    color: 0x9cb6f9, opacity: quality.antialias ? .87 : .56, transmission: quality.antialias ? .78 : 0,
    thickness: .26, attenuationColor: new THREE.Color(0x8895ef), attenuationDistance: .75,
    emissive: 0x596ed4, emissiveIntensity: .26,
  }));
  mantle.renderOrder = 2;
  tissue.renderOrder = 3;
  main.add(mantle, tissue);

  const distant = (geometry, color, opacity) => {
    const mesh = new THREE.InstancedMesh(geometry, deform(new THREE.MeshPhongMaterial({
      color, emissive: 0x372963, shininess: 34, specular: 0x9db6ff,
      transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    }), motion), quality.swarm);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  };
  const swarm = [distant(distantShell, 0xc1dcff, .54), distant(distantDetails, 0xa8a2ff, .38)];
  return {
    main, swarm,
    update(time, pointer, rise) {
      motion.jellyTime.value = time;
      motion.jellySteer.value = pointer.x + Math.sin(rise * 6) * .4;
    },
    dispose() {
      const meshes = [...main.children, ...swarm];
      new Set(meshes.map((mesh) => mesh.geometry)).forEach((geometry) => geometry.dispose());
      meshes.forEach((mesh) => {
        mesh.material.dispose();
        if (mesh.isInstancedMesh) mesh.dispose();
      });
    },
  };
}
