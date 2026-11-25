import * as THREE from '../vendor/three.module.min.js';
import { bellGeometry } from './jellyfish.js';

export function createSwarm(count) {
  const group = new THREE.Group();
  const bells = new THREE.InstancedMesh(bellGeometry(8, 14), new THREE.MeshBasicMaterial({
    color: 0xe5eeff, transparent: true, opacity: .46, depthWrite: false, side: THREE.DoubleSide,
  }), count);
  bells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bells.frustumCulled = false;
  group.add(bells);
  const strands = 4;
  const steps = 5;
  const tips = new Float32Array(count * strands * steps * 6);
  const cable = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(tips, 3).setUsage(THREE.DynamicDrawUsage);
  cable.setAttribute('position', attribute);
  const trails = new THREE.LineSegments(cable, new THREE.LineBasicMaterial({
    color: 0x9aa9fa, transparent: true, opacity: .25, depthWrite: false,
  }));
  trails.frustumCulled = false;
  group.add(trails);

  const marker = new THREE.Object3D();
  const point = new THREE.Vector3();
  const color = new THREE.Color();
  const cells = Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963;
    const ring = Math.sqrt((index + .5) / count);
    color.setHSL(.52 + (index % 7) * .035, .59, .49 + (index % 5) * .075);
    bells.setColorAt(index, color);
    return { angle, ring, scale: .085 + (index % 9) * .014, depth: -1.7 - (index % 11) * .53 };
  });

  let imported;
  return {
    group,
    useModel(meshes) {
      bells.visible = trails.visible = false;
      imported = meshes;
      group.add(...meshes);
    },
    update(time, rise, spread, water, pointer, compact) {
      group.visible = water > .82 && rise > .045;
      if (!group.visible) return;
      let cursor = 0;
      const drift = Math.min(time * .032, 3);
      cells.forEach(({ angle, ring, scale, depth }, index) => {
        const pulse = 1 + .15 * Math.sin(time * 1.75 + angle);
        const width = compact ? 2.15 : 4.9;
        const gatherX = Math.cos(angle) * ring * width + Math.sin(rise * 3.2) * .53;
        const gatherY = -5.7 + rise * 8.6 + Math.sin(angle) * ring * 2.4;
        const driftX = Math.cos(angle + drift * .6) * ring * width * 1.48;
        const driftY = Math.sin(angle + drift * .4) * ring * 4.1;
        marker.position.set(THREE.MathUtils.lerp(gatherX, driftX, spread) + Math.sin(time * .85 + angle) * .17 + pointer.x * .13,
          THREE.MathUtils.lerp(gatherY, driftY, spread) + Math.cos(time * .68 + angle) * .21,
          depth + Math.sin(angle) * spread * 1.4);
        marker.rotation.set(.14 * Math.sin(angle), .2 * Math.sin(time + index), Math.sin(angle + time * .31) * .24);
        if (imported) marker.scale.setScalar(scale);
        else marker.scale.set(scale * pulse, scale * (2 - pulse), scale * pulse);
        marker.updateMatrix();
        if (imported) {
          imported.forEach((mesh) => mesh.setMatrixAt(index, marker.matrix));
          return;
        }
        bells.setMatrixAt(index, marker.matrix);
        for (let strand = 0; strand < strands; strand++) {
          for (let segment = 0; segment < steps; segment++) {
            for (let step = segment; step <= segment + 1; step++) {
              const t = step / steps;
              const sway = Math.sin(time * 1.6 - t * 4 + angle + strand) * t * .45;
              point.set((strand - 1.5) * .37 + sway, -.11 - t * (1.8 + strand * .28), Math.cos(strand) * .22);
              point.applyMatrix4(marker.matrix);
              tips[cursor++] = point.x;
              tips[cursor++] = point.y;
              tips[cursor++] = point.z;
            }
          }
        }
      });
      if (imported) imported.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
      else {
        bells.instanceMatrix.needsUpdate = true;
        attribute.needsUpdate = true;
      }
    },
  };
}
