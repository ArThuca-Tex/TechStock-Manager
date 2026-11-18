window.addEventListener('submit', (event) => {
  if (event.defaultPrevented || event.target.method !== 'post' || !event.submitter) return;
  event.submitter.setAttribute('aria-busy', 'true');
});

window.addEventListener('pageshow', () => {
  for (const button of document.querySelectorAll('button[aria-busy="true"]')) {
    button.removeAttribute('aria-busy');
  }
});
