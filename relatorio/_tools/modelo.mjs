import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const pages=await(await fetch('http://127.0.0.1:9333/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1400,height:750,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:pathToFileURL(path.resolve('relatorio/imagens/modelo-relacional.svg')).href});
await new Promise(r=>setTimeout(r,600));
const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1400,height:750,scale:1}});
fs.writeFileSync('relatorio/imagens/modelo-relacional.png',Buffer.from(result.data,'base64'));
ws.close();console.log('Diagrama pronto.');
