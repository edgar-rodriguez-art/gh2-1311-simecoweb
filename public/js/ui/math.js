// Renderiza con KaTeX cada elemento [data-tex] dentro de `root`.
export function renderMath(root) {
  if (!root || !window.katex) return;
  root.querySelectorAll('[data-tex]').forEach((el) => {
    if (el.dataset.texDone) return;
    try {
      window.katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: el.dataset.display !== 'inline' });
      el.dataset.texDone = '1';
    } catch {
      el.textContent = el.dataset.tex;
    }
  });
}
