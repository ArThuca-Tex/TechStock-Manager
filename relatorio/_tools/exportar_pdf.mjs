import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const pages=await(await fetch('http://127.0.0.1:9333/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evalValue(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
await call('Page.enable');await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1000,height:1100,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:pathToFileURL(path.resolve('relatorio/Relatorio_TechStock_Equipe_Over.html')).href});
await new Promise(r=>setTimeout(r,700));
await call('Emulation.setEmulatedMedia',{media:'print'});
await evalValue('Promise.all([...document.images].map(img=>img.decode().catch(()=>null)))');
const layout=await evalValue(`([...document.querySelectorAll('.sheet')].map((el,i)=>({page:i+1,title:el.querySelector('h1').innerText,height:Math.round(el.getBoundingClientRect().height),images:[...el.querySelectorAll('img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,src:img.getAttribute('src')}))})))`);
fs.writeFileSync('relatorio/_work/paginacao.json',JSON.stringify(layout,null,2));
console.log(JSON.stringify(layout.map(p=>({page:p.page,height:p.height,images:p.images.length}))));
if(layout.some(p=>p.height>988||p.images.some(img=>!img.loaded)))throw new Error('Revisar paginação ou imagens antes de exportar');
const pdf=await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;padding:0 18mm;color:#677561;display:flex;justify-content:space-between;"><span>TechStock Manager · Equipe Over</span><span class="pageNumber"></span></div>'});
fs.writeFileSync('relatorio/Relatorio_TechStock_Equipe_Over.pdf',Buffer.from(pdf.data,'base64'));
await call('Emulation.setEmulatedMedia',{media:'screen'});
const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:100,y:40,width:800,height:1100,scale:1}});
fs.writeFileSync('relatorio/_work/capa-preview.png',Buffer.from(screenshot.data,'base64'));
ws.close();console.log('PDF exportado.');
