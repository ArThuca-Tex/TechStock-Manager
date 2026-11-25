const { chromium }=require('./playwright/package');
const fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
for (const [tag, width,height,quality] of [['mobile',390,660,'baixa'],['desktop',800,500,'alta'],['fallback',800,500,'baixa']]) {
const page=await browser.newPage({viewport:{width,height}}); await page.addInitScript(() => { const raf=window.requestAnimationFrame.bind(window); window.requestAnimationFrame=(cb)=>raf(t=>{ if (!window.freezeFrames) cb(t); }); });
page.on('pageerror', e=>console.log('PAGE ERROR',e.message));
page.on('console', m=>{if(['warning','error'].includes(m.type()))console.log(m.type(),m.text().slice(0,2400));});
if(tag==='fallback')await page.route('**/jellyfish.fbx',route=>route.abort());
const requested=page.waitForResponse(r=>r.url().endsWith('/jellyfish.fbx'),{timeout:15000}).catch(()=>null);
await page.goto('http://127.0.0.1:5023/?qualidade='+quality);
await page.waitForSelector('.cinema.has-webgl');
if(tag!=='fallback')console.log(tag,'FBX status',(await requested)?.status());
await page.waitForTimeout(1000);
const phases=tag==='desktop'?[.443,.585,.715,.845,.997]:[.443];
for(const p of phases){
 await page.evaluate(p=>{const s=ScrollTrigger.getAll()[0];window.scrollTo(0,s.start+(s.end-s.start)*p)},p);
 await page.mouse.move(width*.64,height*.4);
 await page.waitForTimeout(700); await page.evaluate(()=>window.freezeFrames=true);
 const cdp=await page.context().newCDPSession(page); const shot=await cdp.send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('.fbx-work/'+tag+'-'+p+'.png',Buffer.from(shot.data,'base64')); await cdp.detach(); await page.reload(); await page.waitForSelector('.cinema.has-webgl');
}
await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

