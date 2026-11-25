import * as THREE from '../vendor/three.module.min.js';
import { bellGeometry, createJellyfish } from './jellyfish.js';
import { createSwarm } from './jelly-swarm.js';
import { createOceanParticles } from './ocean-particles.js';

export function createOcean(quality) {
  const group = new THREE.Group();
  const jelly = createJellyfish(quality, bellGeometry(20 * quality.detail, 40 * quality.detail));
  const school = createSwarm(quality.swarm);
  const particles = createOceanParticles(quality.compact);
  const debris = new THREE.Group();
  const componentMaterial = new THREE.MeshStandardMaterial({ color: 0x456260, roughness: .47, metalness: .52 });
  const solder = new THREE.MeshStandardMaterial({ color: 0x999a9d, roughness: .31, metalness: .82 });
  const bodies = new THREE.BoxGeometry(.39, .28, .1);
  const ends = new THREE.BoxGeometry(.09, .25, .085);
  const count = quality.compact ? 6 : 12;
  const parts = Array.from({ length: count }, (_, index) => {
    const chip = new THREE.Group();
    chip.add(new THREE.Mesh(bodies, componentMaterial));
    for (const x of [-.23, .23]) {
      const terminal = new THREE.Mesh(ends, solder);
      terminal.position.x = x;
      chip.add(terminal);
    }
    chip.scale.setScalar(.18 + (index % 5) * .07);
    debris.add(chip);
    return chip;
  });
  group.add(particles.group, school.group, jelly.body, debris);

  let disposed = false;
  let model;
  import('./jelly-fbx.js').then(({ loadJellyfish }) => {
    if (!disposed) return loadJellyfish(quality);
  }).then((loaded) => {
    if (!loaded) return;
    if (disposed) {
      loaded.dispose();
      return;
    }
    model = loaded;
    jelly.useModel(model.main);
    school.useModel(model.swarm);
  }).catch((error) => console.warn('Não foi possível carregar jellyfish.fbx:', error));

  return {
    group,
    stopLoading() { disposed = true; },
    update(time, state, pointer, compact) {
      const { water, rise, spread } = state;
      group.visible = water > .005;
      if (!group.visible) return;
      model?.update(time, pointer, rise);
      particles.update(time, water, rise, spread);
      school.update(time, rise, spread, water, pointer, compact);
      jelly.body.visible = false;
      if (rise > 0) jelly.update(time, rise, pointer, compact);
      debris.visible = rise > 0;
      if (!debris.visible) return;
      parts.forEach((part, index) => {
        const angle = index * 2.399963;
        const y = 5.5 - ((time * (.23 + index % 5 * .025) + index * 1.71) % 11);
        const x = Math.cos(angle) * (compact ? 2.2 : 4.1) + Math.sin(rise * 5 + time * .35 + angle) * .45;
        part.position.set(x, y, -4 - (index % 7) * .67 - rise * 2);
        part.rotation.set(angle + rise * 1.23, rise * (1 + index * .11), .35 * Math.sin(angle + time * .4));
      });
    },
  };
}
