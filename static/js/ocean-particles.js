import * as THREE from '../vendor/three.module.min.js';

export function createOceanParticles(compact) {
  const count = compact ? 58 : 148;
  const points = [];
  const motion = [];
  const marks = [];
  const speeds = [];
  for (let index = 0; index < count; index++) {
    const rand = (salt) => Math.abs(Math.sin((index + salt) * 725.31) * 751.9) % 1;
    const x = (rand(1) - .5) * (compact ? 9 : 20);
    const y = rand(3) * 15;
    const z = -10 + rand(5) * 12;
    const speed = .35 + rand(7) * 1.55;
    points.push(x, y, z);
    speeds.push(speed);
    if (index % 3 !== 0) continue;
    const length = .16 + rand(9) * .79;
    const w = .002 + rand(11) * .012;
    for (const [dx, dy] of [[-w, 0], [w, 0], [w, length], [-w, 0], [w, length], [-w, length]]) {
      marks.push(x + dx, y, z);
      motion.push(speed, dy, length);
    }
  }
  const uniforms = { clock: { value: 0 }, ascent: { value: 0 }, strength: { value: 0 } };
  const hazeGeometry = new THREE.BufferGeometry();
  hazeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  hazeGeometry.setAttribute('flow', new THREE.Float32BufferAttribute(speeds, 1));
  const haze = new THREE.Points(hazeGeometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float clock;
      uniform float ascent;
      attribute float flow;
      varying float soft;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - ascent * 5. - clock * flow * .19, 15.) - 7.5;
        p.x += sin(p.y * .64 + clock * .49 + p.z) * .27;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(17. * flow / -mv.z, 1., 5.);
        soft = flow * .52;
      }`,
    fragmentShader: `
      uniform float strength;
      varying float soft;
      void main() {
        float alpha = 1. - smoothstep(.05,.5,length(gl_PointCoord-.5));
        gl_FragColor = vec4(.66,.84,1.,alpha*soft*strength*.62);
      }`,
  }));
  haze.frustumCulled = false;

  const streamGeometry = new THREE.BufferGeometry();
  streamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
  streamGeometry.setAttribute('flow', new THREE.Float32BufferAttribute(motion, 3));
  const streams = new THREE.Mesh(streamGeometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      uniform float clock;
      uniform float ascent;
      attribute vec3 flow;
      varying float fade;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - ascent * (3. + flow.x * 2.) - clock * flow.x * .43, 15.) - 7.5 + flow.y;
        p.x += sin(p.y * .6 + clock * .3 + p.z) * .13;
        fade = (1. - flow.y / flow.z) * flow.x * .26;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `
      uniform float strength;
      varying float fade;
      void main() { gl_FragColor = vec4(.76,.88,1.,fade*strength); }`,
  }));
  streams.frustumCulled = false;
  const group = new THREE.Group();
  group.add(haze, streams);
  return {
    group,
    update(time, water, rise, spread) {
      group.visible = water > .005;
      uniforms.clock.value = time;
      uniforms.ascent.value = water + rise * .8;
      uniforms.strength.value = water * (1 - spread * .65);
    },
  };
}
