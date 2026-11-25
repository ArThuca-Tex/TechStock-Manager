import fs from 'node:fs';
import { loadJellyfish } from '../static/js/jelly-fbx.js';
globalThis.ProgressEvent = class { constructor(type, data) { Object.assign(this, data); } };
globalThis.fetch = async () => new Response(fs.readFileSync('static/models/jellyfish.fbx'));
for(const compact of [true,false]){
 const start=performance.now();
 const model=await loadJellyfish({compact,antialias:!compact,swarm:compact?12:28});
 console.log('compact',compact,'ms',Math.round(performance.now()-start),'main triangles',model.main.children.map(m=>m.geometry.attributes.position.count/3),'LOD triangles',model.swarm.map(m=>m.geometry.index.count/3));
 model.dispose();
}

