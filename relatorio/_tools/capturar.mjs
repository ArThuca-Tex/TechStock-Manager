import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const work = path.join(root, 'relatorio');
const pages = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const target = pages.find(p => p.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error',reject,{once:true});});
let seq=0; const pending=new Map();
ws.addEventListener('message',event=>{const m=JSON.parse(event.data); const p=pending.get(m.id); if(p){pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
function call(method, params={}) {return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression) {const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await call('Page.enable'); await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
async function ready() {for(let i=0;i<50;i++){try {if(await evaluate("document.readyState === 'complete'")){await evaluate('document.fonts.ready.then(()=>true)');await pause(250);return;}}catch{} await pause(100);}throw new Error('Page timeout');}
async function go(route) {await call('Page.navigate',{url:'http://127.0.0.1:5012'+route});await pause(150);await ready();const body=await evaluate('document.body.innerText');if(body.includes('Internal Server Error'))throw new Error('HTTP500 '+route);}
async function shot(file,full=false) {
 await evaluate('window.scrollTo(0,0)');
 const height=await evaluate('Math.ceil(Math.max(740, document.querySelector(".content")?.getBoundingClientRect().bottom + 16 || 900))');
 const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height:Math.min(height,full?2400:1400),scale:1}});
 fs.writeFileSync(path.join(work,'imagens',file),Buffer.from(result.data,'base64')); console.log(file);
}
await go('/login');await shot('01-login.png');
await evaluate(`document.querySelector('[name=email]').value='gerente@techstore.com';document.querySelector('[name=senha]').value='Gerente@123';document.querySelector('.login-card form').requestSubmit();`);
await pause(350);await ready();
if(!(await evaluate('document.body.innerText')).includes('GERENTE')) throw new Error('Login falhou');
await shot('02-catalogo.png');
await go('/pdv');
await evaluate(`document.querySelector('#produto').selectedIndex=1;document.querySelector('#qtd').value=2;document.querySelector('#adicionar').click();document.querySelector('#produto').selectedIndex=2;document.querySelector('#adicionar').click();document.querySelector('[name=cliente_nome]').value='Empresa fictícia de teste';document.querySelector('[name=cliente_documento]').value='00.000.000/0000-00';`);
await shot('03-caixa.png');
await go('/vendas'); await shot('04-vendas.png');
await go('/vendas/1');await shot('05-recibo.png');
await call('Emulation.setEmulatedMedia',{media:'print'});
const printResult=await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:false,paperWidth:8.2677,paperHeight:11.6929,marginTop:0.45,marginBottom:0.45,marginLeft:0.45,marginRight:0.45});
fs.writeFileSync(path.join(work,'Recibo_Demonstracao.pdf'),Buffer.from(printResult.data,'base64'));
await shot('06-impressao.png');
await call('Emulation.setEmulatedMedia',{media:'screen'});
await go('/movimentacoes');await shot('07-movimentacoes.png',true);
await go('/pdv');
await evaluate(`document.querySelector('#produto').selectedIndex=1;document.querySelector('#qtd').value=1;document.querySelector('#adicionar').click();document.querySelector('[name=cliente_nome]').value='Teste de saldo';document.querySelector('[name=cliente_documento]').value='000.000.000-00';document.querySelector('[name=quantidade]').value=999;document.querySelector('#checkout').submit();`);
await pause(350);await ready();
if(!(await evaluate('document.body.innerText')).includes('Estoque insuficiente')) throw new Error('Erro de saldo não apareceu');
await shot('08-saldo-insuficiente.png');
await go('/vendas');
await evaluate(`document.querySelector('form[action$="/2/cancelar"]').submit();`);
await pause(350);await ready();await shot('09-cancelamento.png');
await go('/cadastros');await shot('10-cadastros.png');
await go('/produtos/novo');await shot('11-novo-produto.png');
console.log('Capturas concluídas. Banco isolado da demonstração.');
ws.close();
