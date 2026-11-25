import fs from 'node:fs';
import { FBXLoader } from '../static/vendor/loaders/FBXLoader.js';
import { Matrix4, Quaternion, Box3, Vector3 } from '../static/vendor/three.module.min.js';
const root = new FBXLoader().parse(Uint8Array.from(fs.readFileSync('static/models/jellyfish.fbx')).buffer, '');
root.updateMatrixWorld(true);
const matrix = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,.85,-.52).normalize(),new Vector3(0,1,0)));
for(const mesh of root.children) {
  const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(matrix); g.computeBoundingBox();
  console.log(mesh.name, mesh.material.name, Object.keys(g.attributes).join(','), ...[g.boundingBox.min,g.boundingBox.max].map(v=>v.toArray().map(x=>x.toFixed(1)).join(' ')));
}
