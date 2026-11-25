import fs from 'node:fs';
import { FBXLoader } from '../static/vendor/loaders/FBXLoader.js';
import { Box3, Vector3 } from '../static/vendor/three.module.min.js';
const source = fs.readFileSync('static/models/jellyfish.fbx');
const root = new FBXLoader().parse(Uint8Array.from(source).buffer, '');
root.updateMatrixWorld(true);
console.log('clips', root.animations.map(c=>c.name), 'root', root.name);
root.traverse(n => {
 let b = new Box3().setFromObject(n,true);
 const fmt=v=>v.toArray().map(x=>+x.toFixed(3)).join(' ');
 console.log(n.parent?.name, '>', n.name, n.type, n.geometry?.attributes.position.count, fmt(b.min), fmt(b.max));
});
