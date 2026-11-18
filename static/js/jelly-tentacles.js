import * as THREE from '../vendor/three.module.min.js';

export function createTentacles(compact) {
  const count = compact ? 14 : 22;
  const arms = compact ? 4 : 6;
  const steps = compact ? 24 : 38;
  const positions = new Float32Array((count + arms) * (steps + 1) * 6);
  const colors = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();
  for (let strip = 0; strip < count + arms; strip++) {
    const arm = strip >= count;
    for (let segment = 0; segment <= steps; segment++) {
      const t = segment / steps;
      const point = (strip * (steps + 1) + segment) * 2;
      const fade = Math.pow(1 - t, .62);
      const color = arm ? [.69, .47 + t * .24, 1] : [.38 + (strip % 3) * .14, .83 - t * .23, 1];
      colors.push(...color, fade * (arm ? .42 : .67), ...color, fade * (arm ? .09 : .36));
      if (segment < steps) indices.push(point, point + 1, point + 2, point + 1, point + 3, point + 2);
    }
  }
  geometry.setIndex(indices);
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('ink', new THREE.Float32BufferAttribute(colors, 4));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 ink;
      varying vec4 strand;
      void main() {
        strand = ink;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying vec4 strand;
      void main() { gl_FragColor = strand; }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  return {
    mesh,
    update(time, pulse, drift) {
      let offset = 0;
      for (let strip = 0; strip < count + arms; strip++) {
        const arm = strip >= count;
        const angle = strip * 2.399963;
        const root = arm ? .23 + (strip % 3) * .07 : .92 + (strip % 4) * .035;
        const length = arm ? 1.42 + (strip % 3) * .21 : 1.85 + (strip % 7) * .2;
        for (let segment = 0; segment <= steps; segment++) {
          const t = segment / steps;
          const lag = time * 1.65 - t * 5;
          const curl = angle + t * (arm ? 2.5 : .48);
          const pull = root * (1 - (arm ? .12 : .47) * t) * (1 - .14 * pulse * Math.exp(-t * 4));
          const swing = t * (.13 + (strip % 3) * .055);
          const x = Math.cos(curl) * pull + Math.sin(lag + angle) * swing + t * t * drift * .25;
          const y = (arm ? .14 : -.12) - t * length + Math.sin(lag + strip) * t * .09;
          const z = Math.sin(curl) * pull + Math.cos(lag + angle) * swing;
          const width = (arm ? .105 * (.64 + .36 * Math.sin(t * 28 - time * 2 + strip)) : .013)
            * Math.pow(1 - t, .74);
          positions[offset++] = x - width;
          positions[offset++] = y;
          positions[offset++] = z - width * .34;
          positions[offset++] = x + width;
          positions[offset++] = y + (arm ? .038 : 0);
          positions[offset++] = z + width * .34;
        }
      }
      attribute.needsUpdate = true;
    },
  };
}
