import * as THREE from '../vendor/three.module.min.js';
import { bellGeometry, createJellyfish } from './jellyfish.js';
import { createSwarm } from './jelly-swarm.js';
import { createOceanParticles } from './ocean-particles.js';

export function createOcean(quality) {
  const group = new THREE.Group();
  const jelly = createJellyfish(quality.compact, bellGeometry(20 * quality.detail, 40 * quality.detail));
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
    chip.scale.setScalar(.5 + (index % 5) * .19);
    debris.add(chip);
    return chip;
  });
  group.add(particles.group, school.group, jelly.body, debris);

  return {
    group,
    update(time, state, pointer, compact) {
      const { water, sink, rise, spread } = state;
      group.visible = water > .005;
      if (!group.visible) return;
      particles.update(time, water, rise, spread);
      school.update(time, rise, spread, water, pointer, compact);
      jelly.body.visible = false;
      if (water > .77 && rise > .015 && rise < .995) jelly.update(time, rise, water, pointer);
      debris.visible = sink > .01 && sink < .98;
      if (!debris.visible) return;
      parts.forEach((part, index) => {
        const angle = index * 2.399963;
        const y = 2.8 + Math.sin(angle) * 2.6 - sink * (7.1 + (index % 5) * .78);
        const x = Math.cos(angle) * (compact ? 2.2 : 4.1) + Math.sin(sink * 5 + time * .35 + angle) * .45;
        part.position.set(x, y, -1 - (index % 7) * .67 - sink * 2);
        part.rotation.set(angle + sink * 1.23, sink * (1 + index * .11), .35 * Math.sin(angle + time * .4));
      });
    },
  };
}
