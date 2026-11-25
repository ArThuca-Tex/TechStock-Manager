import { underwaterCue } from './landing-timeline.js';
import * as THREE from '../vendor/three.module.min.js';
import { createChip, createCooler, createMotherboard } from './hardware.js';
import { createOcean } from './ocean-scene.js';
import { landingQuality } from './landing-quality.js';

function makeEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const surface = canvas.getContext('2d');
  surface.fillStyle = '#222832';
  surface.fillRect(0, 0, 512, 256);
  for (const [x, y, w, h, light] of [[76, 60, 147, 48, '#e6e7e5'], [281, 77, 66, 37, '#729dcd'], [378, 146, 96, 22, '#afb6be']]) {
    const gradient = surface.createRadialGradient(x, y, 0, x, y, w / 2);
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, 'transparent');
    surface.save();
    surface.translate(x, y);
    surface.scale(1, h / w);
    surface.translate(-x, -y);
    surface.fillStyle = gradient;
    surface.fillRect(x - w / 2, y - w / 2, w, w);
    surface.restore();
  }
  const source = new THREE.CanvasTexture(canvas);
  source.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(source);
  source.dispose();
  generator.dispose();
  return environment;
}

export function mountScene(host, state, onContextLost) {
  const canvas = document.createElement('canvas');
  const quality = landingQuality();
  const attributes = { alpha: true, antialias: quality.antialias, powerPreference: 'low-power' };
  const context = canvas.getContext('webgl2', attributes);
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ ...attributes, canvas, context });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.transmissionResolutionScale = quality.antialias ? .65 : .4;
  host.append(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x111b34, 0);
  const environment = makeEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .76;
  const ocean = createOcean(quality);
  scene.add(ocean.group);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  const key = new THREE.DirectionalLight(0xfff2dd, 3.6);
  const edge = new THREE.DirectionalLight(0xaecafa, 3.5);
  const fill = new THREE.DirectionalLight(0xc9d5e8, 1.15);
  fill.position.set(2, -3, -2);
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x33445d, .85), key, edge, fill);

  const chip = createChip();
  const fan = createCooler();
  const board = createMotherboard();
  chip.name = 'cpu';
  fan.model.name = 'cooler';
  board.name = 'motherboard';
  scene.add(chip, fan.model, board);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x77beed, metalness: .24, roughness: .22, clearcoat: .78,
    transmission: quality.compact ? 0 : .86, thickness: .32, ior: 1.46,
  });
  const crystals = [1, .8, .58].map((size) => {
    const geometry = new THREE.SphereGeometry(.30 * size, 28, 18);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      vertices.setXYZ(i, x * (1 + y), y + x * z * 2, z * (1 - x));
    }
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, glass);
  });
  crystals[0].scale.set(1, 1.6, .62);
  crystals[1].scale.set(1, 1, 1.65);
  scene.add(...crystals);

  // Bounding spheres derived from the assembled meshes enclose all rotated vertices.
  const fallingModels = { motherboard: board, cooler: fan.model, cpu: chip };
  const fallingRadii = Object.fromEntries(Object.entries(fallingModels).map(([name, object]) => {
    const bounds = new THREE.Box3().setFromObject(object);
    return [name, new THREE.Vector3(
      Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
      Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)),
      Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
    ).length()];
  }));
  const pointer = new THREE.Vector2();
  const steering = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const crystalOffsets = crystals.map(() => new THREE.Vector2());
  let width = 0;
  let height = 0;
  let lost = false;
  let lastFrame = 0;
  let slowFrames = 0;

  function render(now = 0) {
    if (lost || !width || !height) return false;
    const { chipSize, chipTurn, fanSize, fanTurn, rotor, split, boardSize, boardTurn, cameraMove, phase, ambient, water, rise } = state;
    const compact = width < 760;
    const horizontal = Math.min(1, width / 1040);
    const time = now / 1000;
    const wantedX = Math.abs(pointer.x) <= 1 ? pointer.x : 0;
    const wantedY = Math.abs(pointer.y) <= 1 ? pointer.y : 0;
    steering.x = THREE.MathUtils.lerp(steering.x, wantedX, .075);
    steering.y = THREE.MathUtils.lerp(steering.y, wantedY, .075);
    ocean.update(time, state, steering, compact);

    const fit = compact ? Math.max(11, 6.9 * height / width) : 8.35;
    camera.position.set(.16 + cameraMove * .32, .35 - cameraMove * .28 + water * .43 + rise * .26,
      fit + split * (compact ? 1.9 : 3.35) + cameraMove * .76 + water * .66);
    camera.lookAt(0, 0, 0);
    key.position.set(-3.1 + 2.1 * cameraMove, 4.5, 5.8);
    edge.position.set(3.7, 1.1 + cameraMove, -3.1);
    edge.intensity = 2 + split * .82 + water * 1.3;
    key.intensity = 3.4 - water * 1.7;
    scene.environmentIntensity = .76 - water * .39;
    scene.fog.density = water * .034;

    const studio = phase < .33;
    chip.visible = studio && chipSize > .012;
    chip.position.set(compact ? .08 : .95 * horizontal, compact ? -.48 : -.35, 0);
    chip.rotation.set(-.35 + .21 * Math.sin(time * .59), -.32 + time * .29 + chipTurn, -.29 + ambient * .14);
    chip.position.y += Math.sin(time * 1.1) * .095;
    chip.scale.setScalar(chipSize * (compact ? .78 : 1));

    fan.model.visible = studio && fanSize > .012;
    fan.model.position.set(compact ? .25 : .9 * horizontal, compact ? .33 : 0, 0);
    fan.model.rotation.set(-.16 + split * .06, -.58 + fanTurn * .27 - split * .14, -.11 * (1 - split));
    fan.model.scale.setScalar(fanSize * (compact ? .72 : 1) * (1 - split * .24));
    fan.explode(split);
    fan.rotor.rotation.z = rotor + state.spin;

    board.visible = studio && boardSize > .012;
    board.position.set(compact ? .17 : 1.35 * horizontal, compact ? .16 : -.28, 0);
    board.rotation.set(-.41 + boardTurn * .55, .27 - boardTurn * .58, -.25 + boardTurn * .19);
    board.scale.setScalar(boardSize * (compact ? .75 : 1));

    const { hardware, descent } = underwaterCue(phase);
    if (hardware) {
      camera.updateMatrixWorld();
      const object = fallingModels[hardware];
      const depth = fit + (hardware === 'motherboard' ? -1.45 : hardware === 'cooler' ? 3.55 : .65);
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const scale = hardware === 'cpu' ? (compact ? .42 : .54) : hardware === 'cooler' ? .82 : .79;
      const radius = fallingRadii[hardware] * scale;
      const edge = (depth + radius) * halfHeight + radius + .12;
      const halfWidth = depth * halfHeight * camera.aspect;
      const x = halfWidth * (hardware === 'cpu' ? -.73 : hardware === 'cooler' ? .18 : -.05);
      object.visible = true;
      object.scale.setScalar(scale);
      object.position.set(x + Math.sin(descent * Math.PI * 2) * halfWidth * .08,
        edge * (1 - 2 * descent), -depth).applyMatrix4(camera.matrixWorld);
      object.rotation.set(-.36 + descent * .9, -.4 + descent * 1.18, -.22 + descent * .61);
    }

    let moving = false;
    crystals.forEach((object, index) => {
      object.visible = water < .82 && (!compact || index < 2);
      if (!object.visible) return;
      const side = index === 1 ? 1 : -1;
      const x = (compact ? 1.05 : 2.43 * horizontal) * side + index * .12 + Math.sin(phase + index) * .32;
      const y = (index === 0 ? -1.13 : 1.2 - (index - 1) * .27) + Math.cos(phase * .75 + index) * .25;
      const z = .3 - index * .52;
      projected.set(x, y, z).project(camera);
      aim.set(projected.x, projected.y, 0);
      const radius = .47;
      const distance = aim.distanceTo(pointer);
      const reaction = distance < radius ? (1 - distance / radius) * .58 : 0;
      const offset = crystalOffsets[index];
      const targetX = (projected.x - pointer.x) * reaction;
      const targetY = (projected.y - pointer.y) * reaction;
      offset.x = THREE.MathUtils.lerp(offset.x, targetX, .12);
      offset.y = THREE.MathUtils.lerp(offset.y, targetY, .12);
      moving ||= Math.abs(offset.x - targetX) + Math.abs(offset.y - targetY) > .0005;
      object.position.set(x + offset.x * 3, y + offset.y * 3 + ambient * .06 * side - water * 3.5, z);
      const breath = 1 - water;
      object.scale.set(breath, breath * (index === 0 ? 1.6 : 1), breath * (index === 0 ? .62 : index === 1 ? 1.65 : 1));
      object.rotation.set(phase * (.19 + .13 * index) + offset.y * 4, index + phase * .34, phase * side * .23 - offset.x * 4);
    });
    renderer.render(scene, camera);
    if (now - lastFrame > 30 && now - lastFrame < 850) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    lastFrame = now;
    if (slowFrames > 36 && renderer.getPixelRatio() > quality.minPixelRatio) {
      renderer.setPixelRatio(Math.max(quality.minPixelRatio, renderer.getPixelRatio() - .18));
      slowFrames = 0;
    }
    return moving;
  }

  function anchor(part) {
    fan[part].getWorldPosition(projected);
    projected.project(camera);
    return { x: (projected.x * .5 + .5) * width, y: (.5 - projected.y * .5) * height };
  }

  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height || lost) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  function handleContextLost() {
    lost = true;
    canvas.hidden = true;
    onContextLost();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  canvas.addEventListener('webglcontextlost', handleContextLost);
  pointer.set(10, 10);
  resize();

  return {
    render,
    anchor,
    setPointer(x, y) { pointer.set(x, y); },
    dispose() {
      lost = true;
      ocean.stopLoading();
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
        if (object.isInstancedMesh) object.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => {
        material.map?.dispose();
        material.roughnessMap?.dispose();
        material.bumpMap?.dispose();
        material.dispose();
      });
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
