(() => {
  const key = 'techstock-workspace-theme';
  const root = document.documentElement;
  let theme = 'dark';
  try {
    if (localStorage.getItem(key) === 'light') theme = 'light';
  } catch {}
  root.dataset.workspaceTheme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const updateLabel = () => {
      button.textContent = theme === 'light' ? 'Modo escuro' : 'Modo claro';
    };
    updateLabel();
    button.hidden = false;
    button.addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light';
      root.dataset.workspaceTheme = theme;
      updateLabel();
      try {
        localStorage.setItem(key, theme);
      } catch {}
    });
  });
})();
