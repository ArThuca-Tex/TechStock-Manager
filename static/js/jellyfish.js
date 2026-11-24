import * as THREE from '../vendor/three.module.min.js';
import { createTentacles } from './jelly-tentacles.js';

export function bellGeometry(rings, sides) {
  const profile = [];
  for (let row = 0; row <= rings; row++) {
    const t = row / rings;
    const angle = t * 1.63;
    profile.push(new THREE.Vector2(Math.max(.0001, Math.sin(angle) * (1 - .075 * t ** 9)),
      .96 * Math.pow(Math.max(0, Math.cos(angle)), 1.37) - .12 * t ** 4));
  }
  return new THREE.LatheGeometry(profile, sides);
}

export function createJellyfish(quality, geometry) {
  const { compact } = quality;
  const body = new THREE.Group();
  body.name = 'jellyfish';
  const uniform = { clock: { value: 0 }, pulse: { value: 0 }, steer: { value: 0 } };
  const shell = new THREE.ShaderMaterial({
    uniforms: uniform, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      uniform float clock;
      uniform float pulse;
      varying vec3 viewPos;
      varying vec2 skin;
      void main() {
        skin = uv;
        vec3 p = position;
        float edge = pow(uv.y, 3.);
        float flutter = sin(uv.x * 75.398 + clock * 2.1) * .027 + sin(uv.x * 37.699 - clock * 1.3) * .026;
        p.xz *= 1.0 - pulse * .15 + edge * flutter;
        p.y = p.y * (1.0 + pulse * .27) + edge * flutter * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        viewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float clock;
      uniform float steer;
      varying vec3 viewPos;
      varying vec2 skin;
      void main() {
        vec3 n = normalize(cross(dFdx(viewPos), dFdy(viewPos)));
        vec3 view = normalize(-viewPos);
        float rim = pow(1. - abs(dot(n, view)), 2.6);
        float grooves = pow(.5 + .5 * sin(skin.x * 226.194 + skin.y * 4. + sin(skin.y * 13.) * .33), 8.);
        float fold = .5 + .5 * sin(skin.y * 25. - clock * 1.8 + sin(skin.x * 37.699));
        float inner = pow(.5 + .5 * sin(skin.x * 50.265 - skin.y * 7.), 5.) * smoothstep(.32,.96,skin.y);
        float lip = smoothstep(.83,1.,skin.y);
        float shine = pow(abs(dot(n, normalize(vec3(-.58 + steer*.12,.65,.35)))), 13.);
        vec3 color = mix(vec3(.27,.44,.81), vec3(.69,.48,1.), fold);
        color = mix(color, vec3(.66,.93,1.), clamp(rim * .89 + shine * .55, 0., 1.));
        color += vec3(.24,.32,.42) * (inner * .36 + grooves * .19);
        float alpha = .10 + rim * .54 + lip * .29 + grooves * .10 + inner * .14 + shine * .20;
        gl_FragColor = vec4(color, clamp(alpha, .12, .89));
      }`,
  });
  const mantle = new THREE.Mesh(geometry, shell);
  mantle.renderOrder = 4;
  body.add(mantle);
  const refractive = quality.antialias ? new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: 0xced8fa, transmission: .91, transparent: true, opacity: .45, depthWrite: false,
    roughness: .19, thickness: .29, ior: 1.34, iridescence: .7, iridescenceIOR: 1.23,
  })) : null;
  if (refractive) {
    refractive.renderOrder = 1;
    body.add(refractive);
  }

  const subumbrella = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x867bc3, transparent: true, opacity: .19, depthWrite: false, side: THREE.DoubleSide,
  }));
  subumbrella.scale.set(.85, -.22, .85);
  subumbrella.position.y = -.06;
  subumbrella.renderOrder = 3;
  body.add(subumbrella);

  const canalMaterial = new THREE.LineBasicMaterial({ color: 0xa7c5f7, transparent: true, opacity: .45, depthWrite: false });
  const rings = [];
  for (let line = 0; line < 20; line++) {
    const angle = line * Math.PI / 10;
    for (let segment = 0; segment < 18; segment++) {
      for (const point of [segment, segment + 1]) {
        const t = point / 18;
        const wave = angle + .12 * Math.sin(t * 5);
        const r = .09 + .88 * t;
        rings.push(Math.cos(wave) * r, .59 * (1 - t ** 1.9) - .07, Math.sin(wave) * r);
      }
    }
  }
  const canals = new THREE.BufferGeometry();
  canals.setAttribute('position', new THREE.Float32BufferAttribute(rings, 3));
  const organs = new THREE.LineSegments(canals, canalMaterial);
  organs.renderOrder = 3;
  body.add(organs);
  const tentacles = createTentacles(compact);
  body.add(tentacles.mesh);

  return {
    body,
    update(time, rise, pointer, narrow) {
      const pulse = .5 - .5 * Math.cos(time * 2.1);
      refractive?.scale.set(.97 - pulse * .15, .98 + pulse * .27, .97 - pulse * .15);
      uniform.clock.value = time;
      uniform.pulse.value = pulse;
      uniform.steer.value = pointer.x;
      organs.scale.set(1 - pulse * .14, 1 + pulse * .22, 1 - pulse * .14);
      subumbrella.scale.x = subumbrella.scale.z = .85 - pulse * .13;
      tentacles.update(time, pulse, pointer.x + Math.sin(rise * 6) * .4);
      body.position.set(Math.sin(rise * 4.5) * .47 + pointer.x * .23,
        -6 + THREE.MathUtils.smoothstep(rise, 0, .23) * 5.26 + rise * 2.2
        + THREE.MathUtils.smoothstep(rise, .90, 1) * 10.5 + Math.sin(time * 2.1) * .075, .46 - rise * .67);
      body.rotation.set(-.11 + pointer.y * .11, time * .11, Math.sin(rise * 5) * .16 - pointer.x * .19);
      body.visible = rise > 0;
      body.scale.setScalar(narrow ? 1.02 : 1.37);
    },
  };
}
