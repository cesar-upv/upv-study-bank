// Runs synchronously before styles/React to avoid a light frame on dark startup.
(() => {
  let mode = 'system';
  let palette = 'flexoki';
  try {
    const savedMode = localStorage.getItem('study_bank_theme');
    const savedPalette = localStorage.getItem('study_bank_palette');
    if (['light', 'dark', 'system'].includes(savedMode)) mode = savedMode;
    if (['academic', 'flexoki', 'zinc', 'catppuccin'].includes(savedPalette)) palette = savedPalette;
    else if (savedMode === 'light' || savedMode === 'dark') palette = 'academic';
  } catch { /* Storage may be unavailable; the system preference still works. */ }
  document.documentElement.dataset.palette = palette;
  document.documentElement.dataset.theme = mode === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
})();
