import * as THREE from '../vendor/three.module.min.js';

const metal = (color, roughness = .38) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: .58 });
const polymer = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .15 });
const anodized = metal(0x657b89);
const steel = metal(0xa4a9ae);
const graphite = polymer(0x20242b);
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

function brushedMetal() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ink = canvas.getContext('2d');
  for (let row = 0; row < canvas.height; row++) {
    const tone = 123 + Math.floor(19 * Math.sin(row * 153.3) + 12 * Math.cos(row * 26.4));
    ink.fillStyle = `rgb(${tone} ${tone} ${tone})`;
    ink.fillRect(0, row, canvas.width, 1);
  }
  const roughnessMap = new THREE.CanvasTexture(canvas);
  const lid = metal(0xb7b8ba, .61);
  lid.roughnessMap = roughnessMap;
  lid.bumpMap = roughnessMap;
  lid.bumpScale = .0017;
  return lid;
}

export function createChip() {
  const chip = new THREE.Group();
  box(chip, polymer(0x26372f), 2.26, 2.11, .075, 0, 0, -.09);
  box(chip, polymer(0x394141), 2.04, 1.9, .034, 0, 0, -.035);
  mesh(chip, machined(blockOutline(1.89, 1.77, .12), .095), steel, 0, 0, -.008);
  box(chip, brushedMetal(), 1.71, 1.58, .021, 0, 0, .115);
  repeated(chip, new THREE.BoxGeometry(.036, .019, .013), steel,
    Array.from({ length: 22 }, (_, i) => [(i % 11 - 5) * .092, i < 11 ? .935 : -.935, -.033]));

  const pins = Array.from({ length: 17 }, (_, index) => (index - 8) * .116);
  repeated(chip, new THREE.BoxGeometry(.048, .16, .07), solder,
    pins.flatMap((x) => [[x, .97, -.09], [x, -.97, -.09]]));
  repeated(chip, new THREE.BoxGeometry(.16, .048, .07), solder,
    pins.flatMap((y) => [[1.07, y, -.02], [-1.07, y, -.02]]));
  return chip;
}

function curvedBlade() {
  const positions = [];
  const triangles = [];
  const span = 22;
  const chord = 12;
  const layer = (span + 1) * (chord + 1);
  for (const face of [-1, 1]) {
    for (let row = 0; row <= span; row++) {
      const t = row / span;
      for (let col = 0; col <= chord; col++) {
        const u = col / chord;
        const width = .19 + .28 * Math.sin(t * 2.6);
        const angle = .18 - t * .48 + (u - .5) * width / (.3 + t * .76);
        const radius = .265 + t * (.92 - .045 * (2 * u - 1) ** 2);
        const camber = Math.sin(u * Math.PI) * (.07 + .038 * t);
        positions.push(radius * Math.cos(angle), radius * Math.sin(angle),
          camber + (u - .5) * (.17 - .086 * t) + face * (.008 + .016 * Math.sin(u * Math.PI)));
        if (row === span || col === chord) continue;
        const a = (face === 1 ? layer : 0) + row * (chord + 1) + col;
        const b = a + chord + 1;
        if (face === 1) triangles.push(a, b, a + 1, b, b + 1, a + 1);
        else triangles.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const perimeter = [
    ...Array.from({ length: chord }, (_, i) => i),
    ...Array.from({ length: span }, (_, i) => i * (chord + 1) + chord),
    ...Array.from({ length: chord }, (_, i) => span * (chord + 1) + chord - i),
    ...Array.from({ length: span }, (_, i) => (span - i) * (chord + 1)),
  ];
  perimeter.forEach((a, i) => {
    const b = perimeter[(i + 1) % perimeter.length];
    triangles.push(a, b, b + layer, a, b + layer, a + layer);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFan() {
  const model = new THREE.Group();
  const frame = new THREE.Group();
  const support = new THREE.Group();
  const rotor = new THREE.Group();
  const hub = new THREE.Group();
  const fasteners = new THREE.Group();
  model.add(support, hub, rotor, frame, fasteners);

  const rim = blockOutline(2.72, 2.72, .28);
  circularHole(rim, 0, 0, 1.23);
  for (const x of [-1.13, 1.13]) {
    for (const y of [-1.13, 1.13]) {
      circularHole(rim, x, y, .096);
      cylinder(fasteners, steel, .107, .048, x, y, .016, 24);
      cylinder(fasteners, anodized, .047, .15, x, y, -.073, 12);
      box(fasteners, graphite, .109, .023, .008, x, y, .042);
      box(fasteners, graphite, .023, .109, .008, x, y, .042);
    }
  }
  mesh(frame, machined(rim, .19), polymer(0x1d252c));
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
  cylinder(hub, graphite, .35, .16, 0, 0, .02);
  cylinder(hub, steel, .09, .24, 0, 0, .15, 24);
  mesh(hub, new THREE.TorusGeometry(.26, .025, 9, 32), metal(0xa55b38), 0, 0, .109);
  cylinder(rotor, graphite, .302, .145, 0, 0, .025);
  cylinder(rotor, anodized, .238, .019, 0, 0, .104);
  const blade = curvedBlade();
  const bladeMaterial = polymer(0x4b555e);
  for (let index = 0; index < 7; index++) {
    const bladeMesh = mesh(rotor, blade, bladeMaterial);
    bladeMesh.rotation.z = index * Math.PI * 2 / 7;
  }
  return { model, frame, support, rotor, hub, fasteners };
}

export function createMotherboard() {
  const board = new THREE.Group();
  const pcb = polymer(0x203832);
  const socket = metal(0xa5bfcb);
  const slots = polymer(0x344956);
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
  box(board, graphite, .23, .77, .16, 1.66, .73, .093);
  repeated(board, new THREE.BoxGeometry(.047, .042, .025), dark,
    Array.from({ length: 20 }, (_, index) => [1.616 + (index % 2) * .083, .42 + Math.floor(index / 2) * .069, .178]));
  for (const y of [-.66, -.99]) {
    box(board, graphite, .225, .25, .117, 1.72, y, .07);
    box(board, dark, .02, .16, .048, 1.839, y, .088);
  }
  cylinder(board, steel, .164, .038, .61, -1.21, .075, 30);
  mesh(board, new THREE.TorusGeometry(.167, .015, 7, 30), graphite, .61, -1.21, .086);
  repeated(board, new THREE.BoxGeometry(.04, .028, .012), solder,
    Array.from({ length: 48 }, (_, index) => {
      const row = Math.floor(index / 12);
      return [-1.48 + (index % 12) * .087, -1.42 + row * .063, -.015];
    }));
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
