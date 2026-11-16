// Máquina de estados de la barra de ejecución: reiniciada → corriendo ⇄ en pausa → completada.
// El resultado completo ya está calculado; el runner solo revela `k` de `N` pasos.

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function status(run) {
  if (run.running) return 'running';
  if (run.k <= 0) return 'reset';
  if (run.k < run.N) return 'paused';
  return 'done';
}

export function statusLabel(run, unit) {
  switch (status(run)) {
    case 'running': return `Corriendo · ${unit} ${run.k} de ${run.N}`;
    case 'reset': return `Reiniciada · ${unit} 0 de ${run.N}`;
    case 'paused': return `En pausa · ${unit} ${run.k} de ${run.N}`;
    default: return `Completada · ${run.N} ${unit}s`;
  }
}

export function primaryLabel(run) {
  const s = status(run);
  return s === 'running' ? 'Pausar' : s === 'paused' ? 'Reanudar' : 'Ejecutar';
}

/**
 * @param state objeto reactivo { k, N, running }
 * @param opts { ms, onChange(), shouldPause?(k) → true para detenerse al llegar a k }
 */
export function createRunner(state, { ms = 200, onChange = () => {}, shouldPause = null } = {}) {
  let timer = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    state.running = false;
  };
  const tick = () => {
    state.k = Math.min(state.N, state.k + 1);
    if (state.k >= state.N || (shouldPause && shouldPause(state.k))) stop();
    onChange();
  };
  const play = () => {
    if (timer) return;
    if (state.k >= state.N) state.k = 0;
    if (shouldPause && shouldPause(state.k)) { onChange(); return; }
    if (prefersReducedMotion()) {
      state.k = state.N;
      stop();
      onChange();
      return;
    }
    state.running = true;
    timer = setInterval(tick, ms);
    onChange();
  };
  return {
    play,
    pause: () => { stop(); onChange(); },
    toggle: () => (timer ? (stop(), onChange()) : play()),
    step: () => { stop(); state.k = Math.min(state.N, state.k + 1); onChange(); },
    reset: () => { stop(); state.k = 0; onChange(); },
    stop,
    isRunning: () => !!timer,
    destroy: stop,
  };
}
