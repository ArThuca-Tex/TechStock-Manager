import * as THREE from '../vendor/three.module.min.js';

const metal = (color, roughness = .38) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: .58 });
const polymer = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .15 });
const anodized = metal(0x568fbc);
const steel = metal(0xaabfd3);
const graphite = polymer(0x192638);
const solder = metal(0xc8ac79);

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function box(parent, material, width, height, depth, x, y, z) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
}

function cylinder(parent, material, radius, depth, x, y, z, sides = 36) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, sides).rotateX(Math.PI / 2);
  return mesh(parent, geometry, material, x, y, z);
}

function repeated(parent, geometry, material, positions) {
  const batch = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  positions.forEach(([x, y, z], index) => batch.setMatrixAt(index, matrix.makeTranslation(x, y, z)));
  parent.add(batch);
}

function blockOutline(width, height, radius) {
  const x = width / 2;
  const y = height / 2;
  const outline = new THREE.Shape();
  outline.moveTo(-x + radius, -y);
  outline.lineTo(x - radius, -y);
  outline.quadraticCurveTo(x, -y, x, -y + radius);
  outline.lineTo(x, y - radius);
  outline.quadraticCurveTo(x, y, x - radius, y);
  outline.lineTo(-x + radius, y);
  outline.quadraticCurveTo(-x, y, -x, y - radius);
  outline.lineTo(-x, -y + radius);
  outline.quadraticCurveTo(-x, -y, -x + radius, -y);
  return outline;
}

function machined(outline, depth) {
  return new THREE.ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelSize: .028, bevelThickness: .026, bevelSegments: 2, curveSegments: 12,
  });
}

function circularHole(outline, x, y, radius) {
  const cutout = new THREE.Path();
  cutout.absarc(x, y, radius, 0, Math.PI * 2, true);
  outline.holes.push(cutout);
}

function etchedMark(text, caption) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ink = canvas.getContext('2d');
  ink.strokeStyle = '#a3c5e2';
  ink.lineWidth = 2;
  ink.strokeRect(18, 18, 220, 220);
  ink.fillStyle = '#edf6ff';
  ink.textAlign = 'center';
  ink.font = 'bold 76px system-ui';
  ink.fillText(text, 128, 139);
  ink.font = '16px monospace';
  ink.fillText(caption, 128, 175);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
}

export function createChip() {
  const chip = new THREE.Group();
  box(chip, polymer(0x234a68), 2.26, 2.26, .12, 0, 0, -.1);
  box(chip, anodized, 2, 2, .12, 0, 0, 0);
  mesh(chip, machined(blockOutline(1.73, 1.73, .16), .16), steel, 0, 0, .09);
  box(chip, metal(0x455e79), 1.48, 1.48, .02, 0, 0, .284);
  mesh(chip, new THREE.PlaneGeometry(1.4, 1.4), etchedMark('TS', 'TECHSTOCK'), 0, 0, .3);

  const pins = Array.from({ length: 17 }, (_, index) => (index - 8) * .116);
  repeated(chip, new THREE.BoxGeometry(.048, .16, .07), solder,
    pins.flatMap((x) => [[x, 1.07, -.02], [x, -1.07, -.02]]));
  repeated(chip, new THREE.BoxGeometry(.16, .048, .07), solder,
    pins.flatMap((y) => [[1.07, y, -.02], [-1.07, y, -.02]]));
  return chip;
}

export function createFan() {
  const model = new THREE.Group();
  const frame = new THREE.Group();
  const support = new THREE.Group();
  const rotor = new THREE.Group();
  const hub = new THREE.Group();
  model.add(support, rotor, hub, frame);

  const rim = blockOutline(2.72, 2.72, .28);
  circularHole(rim, 0, 0, 1.23);
  for (const x of [-1.13, 1.13]) {
    for (const y of [-1.13, 1.13]) {
      circularHole(rim, x, y, .096);
      cylinder(frame, steel, .108, .048, x, y, .22, 18);
      box(frame, graphite, .107, .024, .006, x, y, .248);
    }
  }
  mesh(frame, machined(rim, .19), metal(0x32475d));
  const collar = new THREE.TorusGeometry(1.213, .026, 8, 64);
  mesh(frame, collar, anodized, 0, 0, .208);
  const back = blockOutline(2.64, 2.64, .25);
  circularHole(back, 0, 0, 1.22);
  mesh(support, machined(back, .075), graphite);
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    const strut = box(support, graphite, 1.35, .16, .09, Math.cos(angle) * .64, Math.sin(angle) * .64, .07);
    strut.rotation.z = angle;
  }
  cylinder(support, graphite, .4, .18, 0, 0, .08);
  cylinder(support, steel, .13, .27, 0, 0, .22, 24);
  cylinder(hub, anodized, .355, .19, 0, 0, .02);
  cylinder(hub, graphite, .284, .025, 0, 0, .128);
  mesh(hub, new THREE.TorusGeometry(.236, .012, 8, 36), steel, 0, 0, .145);
  cylinder(hub, steel, .059, .028, 0, 0, .148, 16);

  const profile = new THREE.Shape();
  profile.moveTo(.21, -.084);
  profile.bezierCurveTo(.52, -.03, .95, -.03, 1.141, -.39);
  profile.bezierCurveTo(1.16, -.28, 1.201, -.085, 1.157, .12);
  profile.bezierCurveTo(1.015, .42, .53, .38, .24, .14);
  profile.closePath();
  const blade = machined(profile, .052);
  const bladeMaterial = metal(0x6b9ab9, .47);
  for (let index = 0; index < 7; index++) {
    const bladeMesh = mesh(rotor, blade, bladeMaterial);
    bladeMesh.rotation.z = index * Math.PI * 2 / 7;
  }
  return { model, frame, support, rotor, hub };
}

export function createMotherboard() {
  const board = new THREE.Group();
  const pcb = polymer(0x153952);
  const socket = metal(0xa5bfcb);
  const slots = polymer(0x3474a5);
  const dark = polymer(0x0c1826);
  const sink = metal(0x557c99);
  const base = blockOutline(3.8, 3.08, .075);
  const corners = [[-1.71, -1.37], [1.71, -1.37], [-1.71, 1.37], [1.71, 1.37]];
  for (const [x, y] of corners) circularHole(base, x, y, .047);
  mesh(board, machined(base, .09), pcb, 0, 0, -.12);
  repeated(board, new THREE.TorusGeometry(.063, .013, 6, 16), solder,
    corners.map(([x, y]) => [x, y, .007]));

  box(board, socket, 1.06, 1.07, .12, -.38, .47, .07);
  box(board, dark, .89, .9, .055, -.38, .47, .151);
  const contactGrid = Array.from({ length: 144 }, (_, index) =>
    [-.71 + (index % 12) * .06, .14 + Math.floor(index / 12) * .06, .184]);
  repeated(board, new THREE.BoxGeometry(.024, .024, .012), solder, contactGrid);
  box(board, steel, .05, 1.09, .055, .19, .51, .164);

  for (let index = 0; index < 4; index++) {
    const x = .43 + index * .18;
    box(board, index % 2 ? slots : graphite, .12, 1.65, .15, x, .48, .088);
    box(board, dark, .032, 1.41, .024, x, .48, .169);
    box(board, steel, .09, .07, .088, x, 1.265, .15);
    box(board, steel, .09, .07, .088, x, -.306, .15);
  }
  for (const y of [-.37, -.79, -1.14]) {
    box(board, slots, 2.23, .115, .136, -.26, y, .075);
    box(board, dark, 1.98, .032, .025, -.29, y, .15);
    box(board, socket, .13, .1, .11, .84, y, .1);
  }
  for (const y of [-1.03, -.65, -.27, .135, .52, .91]) {
    box(board, steel, .3, .31, .27, -1.75, y, .139);
    box(board, dark, .012, .23, .115, -1.902, y, .18);
  }
  repeated(board, new THREE.BoxGeometry(.22, .042, .27), sink,
    Array.from({ length: 17 }, (_, index) => [-1.29, .1 + index * .07, .14]));
  repeated(board, new THREE.BoxGeometry(.048, .43, .24), sink,
    Array.from({ length: 11 }, (_, index) => [.99 + index * .063, -.87, .132]));
  repeated(board, new THREE.CylinderGeometry(.041, .041, .13, 10).rotateX(Math.PI / 2), solder,
    Array.from({ length: 10 }, (_, index) => [-1.09 - (index % 2) * .08, -.22 - Math.floor(index / 2) * .126, .083]));
  repeated(board, new THREE.BoxGeometry(.15, .14, .058), graphite,
    Array.from({ length: 12 }, (_, index) => [.94 + (index % 4) * .21, -.23 + Math.floor(index / 4) * .32, .054]));

  const traces = [];
  for (let index = 0; index < 21; index++) {
    const y = -.92 + index * .045;
    const a = [-1.56, y, .008];
    const b = [-1.21 + index * .017, y, .008];
    const c = [-.68 + index * .017, y + .53, .008];
    const d = [.57 + index * .035, y + .53, .008];
    traces.push(...a, ...b, ...b, ...c, ...c, ...d);
    const edge = .05 + index * .054;
    traces.push(1.82, y + .41, .008, 1.58, y + .41, .008,
      1.58, y + .41, .008, edge, y - .1, .008);
  }
  const circuit = new THREE.BufferGeometry();
  circuit.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3));
  board.add(new THREE.LineSegments(circuit, new THREE.LineBasicMaterial({ color: 0x406980 })));
  return board;
}
