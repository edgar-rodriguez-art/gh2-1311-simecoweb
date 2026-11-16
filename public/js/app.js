// Arranque: store global de Alpine, registro de vistas y router.
import { VIEWS, startRouter, APP_NAME } from './router.js';
import { loadScenarios, addScenario, removeScenario, parseSeed, flushUrl, DEFAULT_SEED } from './store.js';

document.addEventListener('alpine:init', () => {
  const Alpine = window.Alpine;
  let toastTimer = 0;

  if (window.Chart) {
    window.Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    window.Chart.defaults.color = '#475569';
  }

  Alpine.store('app', {
    name: APP_NAME,
    route: '',
    seed: DEFAULT_SEED,
    running: false,
    navOpen: false,
    toast: '',
    scenarios: loadScenarios(),
    current: null,

    setSeed(v) { this.seed = parseSeed(v); },

    go(route) { location.hash = '#/' + route; },

    notify(msg) {
      this.toast = msg;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { this.toast = ''; }, 2600);
    },

    async copyLink() {
      this.current?.flush?.();
      flushUrl();
      const url = location.href;
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          ok = true;
        }
      } catch { ok = false; }
      if (!ok) {
        try {
          const ta = document.createElement('textarea');
          ta.value = url;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch { ok = false; }
      }
      this.notify(ok ? 'Enlace copiado al portapapeles' : 'No se pudo copiar; copia la dirección del navegador');
    },

    saveScenario() {
      const cur = this.current;
      if (!cur) return;
      const n = (this.scenarios[cur.route]?.length ?? 0) + 1;
      let name = window.prompt('Nombre del escenario', `Escenario ${n}`);
      if (name === null) return;
      name = name.trim().slice(0, 60) || `Escenario ${n}`;
      const { all, ok } = addScenario(cur.route, { name, params: cur.params(), seed: this.seed, savedAt: new Date().toISOString() });
      if (ok) {
        this.scenarios = all;
        this.notify(`Escenario «${name}» guardado`);
      } else {
        this.notify('Este navegador no permite guardar escenarios');
      }
    },

    deleteScenario(route, index) {
      const item = this.scenarios[route]?.[index];
      const { all, ok } = removeScenario(route, index);
      if (ok) {
        this.scenarios = all;
        this.notify(`Escenario «${item?.name ?? ''}» borrado`);
      } else {
        this.notify('No se pudo borrar el escenario');
      }
    },
  });

  for (const v of VIEWS) if (v.data) Alpine.data(v.name, v.data);
});

document.addEventListener('alpine:initialized', () => {
  // Enlaces internos que no son rutas (p. ej. «Saltar al contenido»): mover el foco sin tocar el hash.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('#/')) return;
    e.preventDefault();
    const target = document.getElementById(href.slice(1));
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ block: 'start' });
    }
  });
  startRouter(document.getElementById('view'));
});
