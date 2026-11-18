import * as THREE from '../vendor/three.module.min.js';
import { createChip, createFan, createMotherboard } from './hardware.js';
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
  host.append(canvas);

  const scene = new THREE.Scene();
  const environment = makeEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = .76;
  const ocean = createOcean(quality);
  scene.add(ocean.group);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  const key = new THREE.DirectionalLight(0xd5e8ff, 3.6);
  const edge = new THREE.DirectionalLight(0x258cff, 3.5);
  const fill = new THREE.DirectionalLight(0x7086ae, 1.5);
  fill.position.set(2, -3, -2);
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x33445d, 2), key, edge, fill);

  const chip = createChip();
  const fan = createFan();
  const board = createMotherboard();
  scene.add(chip, fan.model, board);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x77beed, metalness: .24, roughness: .22, clearcoat: .78,
    transparent: true, opacity: .33, depthWrite: false, flatShading: true,
  });
  const crystals = [
    new THREE.Mesh(new THREE.IcosahedronGeometry(.29, 0), glass),
    new THREE.Mesh(new THREE.OctahedronGeometry(.26), glass),
    new THREE.Mesh(new THREE.DodecahedronGeometry(.15, 0), glass),
  ];
  const facets = crystals.map((object) => {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(object.geometry, 24),
      new THREE.LineBasicMaterial({ color: 0x9fd8ef, transparent: true, opacity: .21, depthWrite: false }),
    );
    object.add(outline);
    return outline;
  });
  crystals[0].scale.set(1, 1.6, .62);
  crystals[1].scale.set(1, 1, 1.65);
  scene.add(...crystals);

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
    const { chipSize, chipTurn, fanSize, fanTurn, rotor, split, boardSize, boardTurn, cameraMove, phase, ambient, water, sink, rise } = state;
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

    const falling = sink > .001 && sink < .998;
    const sinkArc = Math.pow(Math.max(0, Math.sin(sink * Math.PI)), .68);
    chip.visible = chipSize > .012 || falling;
    chip.position.set((compact ? .05 : .83 * horizontal) + chipTurn * .63, compact ? -.49 : -.58, -.33 - chipTurn * .15);
    chip.rotation.set(-.49 + .1 * chipTurn, -.27 + .48 * chipTurn, -.37 + .6 * chipTurn + ambient * .025);
    chip.scale.setScalar(chipSize * (compact ? .76 : 1));
    if (falling) {
      chip.position.set((compact ? -1.05 : -2.35) + Math.sin(sink * 5 + time * .55) * .47, 3.9 - sink * 9.4, -1.3 - sink * 4.7);
      chip.rotation.set(-.65 + sink * 2, -.33 + sink * .8, -.4 + sink * 1.4);
      chip.scale.setScalar(sinkArc * .66);
    }

    fan.model.visible = fanSize > .012 || falling;
    fan.model.position.set(compact ? .0 : split * .68 * horizontal, compact ? .52 - split * .25 : -.05, -.17);
    fan.model.rotation.set(THREE.MathUtils.lerp(-.19 + fanTurn * .13, -1.39, split), -.24 * (1 - split), -.09 * (1 - split));
    fan.model.scale.setScalar(fanSize * (compact ? .65 : 1) * (1 - split * .13));
    // All five parts move along the same local axis. Tilting the assembly exposes that axis vertically.
    const spacing = falling ? 0 : split;
    fan.support.position.z = -.27 - 1.66 * spacing;
    fan.hub.position.z = -.15 - .88 * spacing;
    fan.rotor.position.z = .018 - .07 * spacing;
    fan.frame.position.z = .15 + .77 * spacing;
    fan.fasteners.position.z = .348 + 1.55 * spacing;
    fan.rotor.rotation.z = rotor + state.spin;
    if (falling) {
      fan.model.position.set((compact ? .92 : 2.17) + Math.sin(sink * 6 + .8) * .58, 4.45 - sink * 9.7, -2.3 - sink * 4.5);
      fan.model.rotation.set(-.5 + sink * 1.9, -.35 + sink * 1.16, sink * -.75);
      fan.model.scale.setScalar(sinkArc * .59);
    }

    board.visible = boardSize > .012;
    board.position.set(compact ? .36 : 1.63 * horizontal, -.45 + boardTurn * .25 - sink * 7.4, -boardTurn * .6 - sink * 3.7);
    board.rotation.set(-.4 + boardTurn * .27, .19 - boardTurn * .5, -.18 + boardTurn * .2);
    board.scale.setScalar(boardSize * (compact ? .63 : 1));

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
      facets[index].material.opacity = .21 + Math.hypot(offset.x, offset.y) * 1.9;
    });
    renderer.render(scene, camera);
    if (water > .11 && now - lastFrame > 30 && now - lastFrame < 175) slowFrames++;
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
        material.dispose();
      });
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
