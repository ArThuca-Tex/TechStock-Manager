const cart = new Map();
const select = document.querySelector('#produto');
const money = cents => (cents / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
function render() {
 const container = document.querySelector('#carrinho'); container.replaceChildren(); let total = 0;
 for (const [id, item] of cart) {
  const row = document.createElement('div'); row.className = 'cart-row';
  const name = document.createElement('p'); name.textContent = item.name;
  const quantity = document.createElement('input'); quantity.type='number'; quantity.min=1; quantity.max=item.stock; quantity.value=item.qty; quantity.name='quantidade'; quantity.required=true; quantity.setAttribute('aria-label', 'Quantidade de ' + item.name);
  quantity.onchange = () => {const n=Number(quantity.value); if (Number.isInteger(n) && n>0 && n<=item.stock) {item.qty=n; render();} else {quantity.value=item.qty; document.querySelector('#erro').textContent='Quantidade fora do saldo disponível.';}};
  const hidden=document.createElement('input'); hidden.type='hidden'; hidden.name='produto_id'; hidden.value=id;
  const subtotal=document.createElement('strong'); subtotal.textContent=money(item.price*item.qty);
  const remove=document.createElement('button'); remove.type='button'; remove.className='text-button danger-text'; remove.textContent='Remover'; remove.onclick=()=>{cart.delete(id); render();};
  row.append(name, hidden, quantity, subtotal, remove); container.append(row); total+=item.price*item.qty;
 }
 document.querySelector('#total').textContent=money(total); document.querySelector('#confirmar').disabled=!cart.size;
 sessionStorage.setItem('techstock-cart', JSON.stringify([...cart]));
}
document.querySelector('#adicionar').onclick=()=>{
 const o=select.selectedOptions[0], qty=Number(document.querySelector('#qtd').value); const error=document.querySelector('#erro'); error.textContent='';
 if (!o.value || !Number.isInteger(qty) || qty<1) {error.textContent='Selecione um produto e uma quantidade inteira positiva.'; return;}
 const current=cart.get(o.value); const stock=Number(o.dataset.saldo);
 if ((current?.qty||0)+qty>stock) {error.textContent='Estoque insuficiente. Disponível: '+stock; return;}
 cart.set(o.value,{name:o.textContent, stock, price:Math.round(Number(o.dataset.preco)*100), qty:(current?.qty||0)+qty}); render();
};
document.querySelector('#busca').oninput=e=>{for(const o of select.options) o.hidden=!!o.value&&!o.textContent.toLowerCase().includes(e.target.value.toLowerCase());};
try {for (const [id,item] of JSON.parse(sessionStorage.getItem('techstock-cart')||'[]')) {if ([...select.options].some(o=>o.value===id)) cart.set(id,item);} } catch {sessionStorage.removeItem('techstock-cart');}
render();
document.querySelector('#checkout').addEventListener('submit',()=>{document.querySelector('#confirmar').disabled=true;});
