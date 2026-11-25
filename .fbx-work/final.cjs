const { chromium }=require('./playwright/package');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
for (const [tag,width,height,quality] of [['desktop',800,500,'alta'],['mobile',390,660,'baixa'],['fallback',800,500,'baixa']]) {
const page=await browser.newPage({viewport:{width,height}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error' && m.text().includes('THREE.')) errors.push(m.text());});
if(tag==='fallback')await page.route('**/jellyfish.fbx',r=>r.abort());
await page.route('**/fbx-test?*',r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#101734}#scene{width:100vw;height:100vh}canvas{width:100%;height:100%;display:block}</style><div id="scene"></div>'}));
await page.route('**/landing-scene.js',async r=>{
const original=fs.readFileSync('static/js/landing-scene.js','utf8');
await r.fulfill({contentType:'text/javascript',body:original.replace('renderer.render(scene, camera);',`
window.drawState = {
 imported: scene.getObjectByName('jellyfish').children.some(n => n.isGroup && n.visible),
 hardware: [chip, fan.model, board].filter(n=>n.visible).map(n=>n.name),
 mainX: scene.getObjectByName('jellyfish').position.x,
 school: scene.children[0].children[1].children.filter(n=>n.visible && n.isInstancedMesh).map(n=>n.instanceMatrix.array[12]),
};
renderer.render(scene, camera);`)});
});
await page.goto('http://127.0.0.1:5024/fbx-test?qualidade='+quality);
// The harness URL is intercepted with a query string by Playwright's wildcard below.
await page.evaluate(async()=>{
const {mountScene}=await import('/static/js/landing-scene.js');
const state=window.demo={phase:.55,rise:.33,water:1,spread:0,chipSize:0,chipTurn:0,fanSize:0,fanTurn:0,rotor:0,split:0,boardSize:0,boardTurn:0,cameraMove:0,ambient:0,spin:0};
window.scene=mountScene(document.querySelector('#scene'),state,()=>{});
});
await page.waitForTimeout(2500);
const frames=tag==='desktop'?[[.521,'motherboard'],[.585],[.651,'cooler'],[.715],[.782,'cpu'],[.845],[.997]]:[[.585]];
let first;
for(const [phase,hardware] of frames){
const frame=await page.evaluate(phase=>{
 Object.assign(demo,{phase,rise:(phase-.33)/.67,spread:Math.min(1,Math.max(0,(phase-.94)/.06))});
 scene.setPointer(phase>.9?.65:0,0);
 scene.render(1250+phase*3000);
 return drawState;
},phase);
assert.equal(frame.imported,tag!=='fallback');
assert.deepEqual(frame.hardware,hardware?[hardware]:[]);
if(!first) first=frame;
if(phase===.997)assert.notDeepEqual(frame.school,first.school);
if(phase===.585||phase===.997){
 const cdp=await page.context().newCDPSession(page);
 const shot=await cdp.send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync('.fbx-work/final-'+tag+'-'+phase+'.png',Buffer.from(shot.data,'base64'));
 await cdp.detach();
}
}
assert.deepEqual(errors,[]);
console.log(tag,'passes',frames.length,'frames');
await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

