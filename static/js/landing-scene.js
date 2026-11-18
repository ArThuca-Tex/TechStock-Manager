import * as THREE from '../vendor/three.module.min.js';
import { createChip, createFan, createMotherboard } from './hardware.js';

export function mountScene(host, state, onContextLost) {
  const canvas = document.createElement('canvas');
  const attributes = { alpha: true, antialias: true, powerPreference: 'low-power' };
  const context = canvas.getContext('webgl2', attributes);
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ ...attributes, canvas, context });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  host.append(canvas);

  const scene = new THREE.Scene();
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
  const projected = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const crystalOffsets = crystals.map(() => new THREE.Vector2());
  let width = 0;
  let height = 0;
  let lost = false;

  function render() {
    if (lost || !width || !height) return false;
    const { chipSize, chipTurn, fanSize, fanTurn, rotor, split, boardSize, boardTurn, cameraMove, phase, ambient } = state;
    const compact = width < 670;
    const horizontal = Math.min(1, width / 1040);

    camera.position.set(.3 + cameraMove * .55, .35 - cameraMove * .28, compact ? 9.8 : 8.05 + cameraMove * .65);
    camera.lookAt(0, 0, 0);
    key.position.set(-3.1 + 2.1 * cameraMove, 4.5, 5.8);
    edge.position.set(3.7, 1.1 + cameraMove, -3.1);
    edge.intensity = 3.1 + split * 1.5;

    chip.visible = chipSize > .012;
    chip.position.set((compact ? .05 : .83 * horizontal) + chipTurn * .63, compact ? -.49 : -.58, -.33 - chipTurn * .15);
    chip.rotation.set(-.49 + .1 * chipTurn, -.27 + .48 * chipTurn, -.37 + .6 * chipTurn + ambient * .025);
    chip.scale.setScalar(chipSize * (compact ? .76 : 1));

    fan.model.visible = fanSize > .012;
    fan.model.position.set(compact ? .05 : 1.35 * horizontal, compact ? .62 : -.05, -.15 - split * .27);
    fan.model.rotation.set(-.22 + fanTurn * .27, -.42 - split * .3 + fanTurn * .22, -.14 + fanTurn * .26);
    fan.model.scale.setScalar(fanSize * (compact ? .64 : 1) * (1 - split * .11));
    fan.frame.position.set(.16 * split, .89 * split, .24 + 1.12 * split);
    fan.frame.rotation.x = -.11 * split;
    fan.support.position.set(.41 * split, -.82 * split, -.19 - 1.03 * split);
    fan.rotor.position.set(-.39 * split, .28 * split, .057 + .45 * split);
    fan.rotor.rotation.z = rotor + ambient * .35;
    fan.hub.position.set(.43 * split, -.24 * split, .08 + .86 * split);

    board.visible = boardSize > .012;
    board.position.set(compact ? .06 : .48 * horizontal, -.49 + boardTurn * .25, -boardTurn * .6);
    board.rotation.set(-.4 + boardTurn * .27, .19 - boardTurn * .5, -.18 + boardTurn * .2);
    board.scale.setScalar(boardSize * (compact ? .63 : 1));

    let moving = false;
    crystals.forEach((object, index) => {
      object.visible = !compact || index < 2;
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
      object.position.set(x + offset.x * 3, y + offset.y * 3 + ambient * .06 * side, z);
      object.rotation.set(phase * (.19 + .13 * index) + offset.y * 4, index + phase * .34, phase * side * .23 - offset.x * 4);
      facets[index].material.opacity = .21 + Math.hypot(offset.x, offset.y) * 1.9;
    });
    renderer.render(scene, camera);
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
        material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
