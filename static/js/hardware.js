import * as THREE from '../vendor/three.module.min.js';

const metal = (color, roughness = .38) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: .87 });
const polymer = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: 0 });
const anodized = metal(0x74797c);
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
  canvas.width = 512;
  canvas.height = 512;
  const ink = canvas.getContext('2d');
  for (let row = 0; row < canvas.height; row++) {
    const tone = 123 + Math.floor(19 * Math.sin(row * 153.3) + 12 * Math.cos(row * 26.4));
    ink.fillStyle = `rgb(${tone} ${tone} ${tone})`;
    ink.fillRect(0, row, canvas.width, 1);
  }
  const roughnessMap = new THREE.CanvasTexture(canvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  const lid = new THREE.MeshPhysicalMaterial({ color: 0xb7b8ba, roughness: .66, metalness: .94, anisotropy: .57 });
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

function createFan() {
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

export function createCooler() {
  const model = new THREE.Group();
  const tower = new THREE.Group();
  const mount = new THREE.Group();
  const fan = createFan();
  const copper = metal(0xb97853, .34);
  const rubber = polymer(0x262529);
  const aluminium = metal(0xc0c1bd, .44);
  const fin = blockOutline(2.58, 1.16, .16);
  const finGeometry = new THREE.ExtrudeGeometry(fin, {
    depth: .019, bevelEnabled: true, bevelSize: .009, bevelThickness: .007,
    bevelSegments: 1, curveSegments: 4,
  }).rotateX(Math.PI / 2);
  repeated(tower, finGeometry, aluminium, Array.from({ length: 35 }, (_, i) => [0, -.89 + i * .062, -.41]));
  mesh(tower, machined(fin, .043).rotateX(Math.PI / 2), graphite, 0, 1.29, -.41);
  const pipe = (parent, points, radius, material) => mesh(parent, new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, 'centripetal'),
    42, radius, 9), material);
  for (let i = 0; i < 4; i++) {
    const depth = -.79 + i * .23;
    pipe(tower, [[-.92, 1.39, depth], [-.92, -.77, depth], [-.71, -1.24, depth],
      [-.29, -1.44, depth], [.29, -1.44, depth], [.71, -1.24, depth],
      [.92, -.77, depth], [.92, 1.39, depth]], .063, copper);
  }
  mesh(mount, machined(blockOutline(1.34, 1.0, .12), .12).rotateX(-Math.PI / 2), steel);
  box(mount, steel, 2.15, .085, .35, 0, -.10, 0);
  for (const x of [-.93, .93]) {
    cylinder(mount, steel, .105, .28, x, 0, 0, 20).rotation.x = Math.PI / 2;
    mesh(mount, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
      Array.from({ length: 64 }, (_, i) => new THREE.Vector3(
        x + Math.cos(i / 63 * Math.PI * 10) * .094, -.06 + i / 63 * .21,
        Math.sin(i / 63 * Math.PI * 10) * .094))), 64, .014, 6), steel);
  }
  for (const x of [-1.16, 1.16]) {
    for (const y of [-1.16, 1.16]) box(fan.frame, rubber, .21, .21, .045, x, y, .225);
    pipe(fan.support, [[x, .81, .18], [x * 1.1, .71, -.22], [x * 1.09, -.66, -.23], [x, -.80, .18]], .025, steel);
  }
  for (let i = 0; i < 4; i++) {
    const z = i * .022;
    pipe(fan.frame, [[1.13, -.88, z], [1.39, -.97, z], [1.43, -1.27, z], [1.2, -1.38, z]], .012, rubber);
  }
  box(fan.frame, graphite, .19, .09, .13, 1.16, -1.38, .033);
  fan.support.position.z = -.19;
  fan.hub.position.z = -.13;
  fan.rotor.position.z = .005;
  fan.frame.position.z = .06;
  fan.fasteners.position.z = .29;
  model.add(tower, mount, fan.model);
  const explode = (amount) => {
    const pull = THREE.MathUtils.smoothstep(amount, 0, .47);
    const stack = THREE.MathUtils.smoothstep(amount, .42, 1);
    mount.position.set(0, -1.62 - amount * 2.14, -.41 * (1 - stack));
    tower.position.set(0, -.6 * stack, .41 * stack);
    fan.model.position.set(0, .03 + stack * 3.03, .45 + pull * 1.33 - stack * 1.78);
    fan.model.rotation.x = -stack * .43;
  };
  explode(0);
  mount.name = 'Cooler mounting assembly';
  return { model, frame: fan.frame, rotor: fan.rotor, support: mount, tower, explode };
}

function pcbFinish() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 832;
  const ink = canvas.getContext('2d');
  ink.fillStyle = '#373838';
  ink.fillRect(0, 0, canvas.width, canvas.height);
  ink.scale(canvas.width / 3.8, canvas.height / 3.08);
  ink.translate(1.9, 1.54);
  for (let i = 0; i < 176; i++) {
    const x = (i * 103 % 179) / 179 * 3.6 - 1.8;
    const y = (i * 61 % 179) / 179 * 2.9 - 1.45;
    const dir = i % 2 ? 1 : -1;
    const run = .09 + i % 7 * .038;
    ink.strokeStyle = i % 4 ? '#484741' : '#575248';
    ink.lineWidth = .0048;
    ink.beginPath();
    ink.moveTo(x, y);
    ink.lineTo(x + dir * run, y);
    ink.lineTo(x + dir * (run + .074), y + dir * .074);
    ink.lineTo(x + dir * (run + .074), y + dir * .125);
    ink.stroke();
    ink.strokeRect(x - .008, y - .008, .016, .016);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

export function createMotherboard() {
  const board = new THREE.Group();
  const pcb = polymer(0xffffff);
  pcb.map = pcbFinish();
  pcb.bumpMap = pcb.map;
  pcb.bumpScale = .006;
  pcb.roughness = .79;
  const socket = metal(0xabadad);
  const slots = polymer(0x36383c);
  const dark = polymer(0x0d0e10);
  const sink = metal(0x575a5c);
  const base = blockOutline(3.8, 3.08, .075);
  const corners = [[-1.71, -1.37], [1.71, -1.37], [-1.71, 1.37], [1.71, 1.37]];
  for (const [x, y] of corners) circularHole(base, x, y, .047);
  const surface = machined(base, .09);
  const uv = surface.attributes.uv;
  const points = surface.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, points.getX(i) / 3.8 + .5, points.getY(i) / 3.08 + .5);
  }
  mesh(board, surface, pcb, 0, 0, -.12);
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

  box(board, graphite, .74, .48, .1, 1.31, -.87, .065);
  const micro = Array.from({ length: 480 }, (_, i) => {
    const x = ((i * 113) % 479) / 479 * 3.4 - 1.68;
    const y = ((i * 283) % 479) / 479 * 2.76 - 1.38;
    return [x, y, .012];
  }).filter(([x, y]) => !(y > -.1 && x > -.94 && x < 1.06));
  repeated(board, new THREE.BoxGeometry(.052, .026, .023), steel, micro);
  repeated(board, new THREE.BoxGeometry(.031, .027, .024), graphite,
    micro.map(([x, y, z]) => [x, y, z + .012]));
  repeated(board, new THREE.TorusGeometry(.012, .004, 4, 8), solder,
    micro.map(([x, y]) => [x + .038, y + .032, .004]));
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
  board.add(new THREE.LineSegments(circuit, new THREE.LineBasicMaterial({ color: 0x4b4640 })));
  return board;
}
