const search = document.querySelector('#catalog-search');
const rows = [...document.querySelectorAll('#catalog-table tbody tr')].filter(row => !row.querySelector('.empty'));
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
search.addEventListener('input', () => {
  const term = normalize(search.value.trim());
  let visible = 0;
  for (const row of rows) {
    row.hidden = !normalize(row.textContent).includes(term);
    if (!row.hidden) visible++;
  }
  document.querySelector('#catalog-count').textContent = visible ? `${visible} produto(s) encontrado(s)` : 'Nenhum produto corresponde à busca.';
});
