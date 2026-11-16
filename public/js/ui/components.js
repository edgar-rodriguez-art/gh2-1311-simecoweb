// Plantillas HTML reutilizables (slider, kpi, runbar, chart-card…) y la fábrica de vistas Alpine.
import { readParams, coerce, serialize, scheduleUrl, flushUrl, routeState } from '../store.js';
import { createRunner, status, statusLabel, primaryLabel } from './runner.js';
import { upsertChart, legendSwatch } from './charts.js';
import { renderMath } from './math.js';

/* ---------------- Formato ---------------- */
export function fx(v, d = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return '∞';
  const r = Number(v);
  return (Object.is(r, -0) ? 0 : r).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const money = (v, d = 2) => (Number.isFinite(v) ? (v < 0 ? '−$' : '$') + fx(Math.abs(v), d) : '∞');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const js = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/* ---------------- Plantillas ---------------- */
export function viewHead({ cat, module, title, desc, dynamic = false }) {
  return `
  <div class="view-head">
    <div class="view-meta">
      <span class="pill-cat">${cat}</span>
      <code class="module-path">${module}</code>
      ${dynamic ? statusPill() : ''}
    </div>
    <h1 tabindex="-1">${title}</h1>
    <p>${desc}</p>
  </div>`;
}

export function statusPill() {
  return `<span role="status" class="status-pill" :class="'st-' + runStatus()"><span class="dot" aria-hidden="true"></span><span x-text="runText()"></span></span>`;
}

/**
 * Slider accesible: label + range + output + edición exacta.
 * o = { id, label, sym, unit, min, max, step, digits, structural, value (expr), set (expr con $v) }
 */
export function slider(o) {
  const digits = o.digits ?? 0;
  const value = o.value ?? `params.${o.id}`;
  const text = `fx(${value}, ${digits}) + '${js(o.unit ? ' ' + o.unit : '')}'`;
  const model = o.value
    ? `:value="${value}" @input="${o.set.replace(/\$v/g, 'Number($event.target.value)')}"`
    : `x-model.number="params.${o.id}"`;
  const disabled = o.structural ? ' :disabled="run.running"' : '';
  return `
  <div class="slider" x-data="{ editing: false, draft: 0 }">
    <div class="slider-row">
      <label for="in-${o.id}">${o.label} <span class="sym">${o.sym}</span></label>
      <button type="button" class="val-btn" x-show="!editing" ${o.structural ? ':disabled="run.running"' : ''}
        @click="draft = ${value}; editing = true; $nextTick(() => $refs.ed.select())"
        :aria-label="'Escribir valor exacto de ${js(o.label)}. Actual: ' + ${text}">
        <output for="in-${o.id}" aria-live="off" x-text="${text}"></output>
      </button>
      <span class="val-edit" x-show="editing" x-cloak>
        <label class="sr-only" for="ed-${o.id}">Valor exacto de ${o.label}</label>
        <input id="ed-${o.id}" x-ref="ed" type="number" min="${o.min}" max="${o.max}" step="any" x-model.number="draft"
          @keydown.enter.prevent="setExact('${o.id}', draft); editing = false"
          @keydown.escape.prevent="editing = false" @blur="if (editing) { setExact('${o.id}', draft); editing = false }">
      </span>
    </div>
    <input id="in-${o.id}" type="range" min="${o.min}" max="${o.max}" step="${o.step}" ${model}${disabled} :aria-valuetext="${text}">
    <div class="range-ends" aria-hidden="true"><span>${fx(o.min, String(o.min).includes('.') ? 1 : 0)}</span><span>${fx(o.max, String(o.max).includes('.') ? 1 : 0)}</span></div>
  </div>`;
}

/** Select nativo. options = [[valor, texto]]. */
export function selectField({ id, label, sym = '', options, number = true, structural = false, change = '' }) {
  return `
  <div class="field">
    <label for="in-${id}">${label}${sym ? ` <span class="sym">${sym}</span>` : ''}</label>
    <select id="in-${id}" x-model${number ? '.number' : ''}="params.${id}"${structural ? ' :disabled="run.running"' : ''}${change ? ` @change="${change}"` : ''}>
      ${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
    </select>
  </div>`;
}

export const group = (text, first = false) => `<span class="group-label${first ? ' first' : ''}">${text}</span>`;

export function kpi(label, value, note = '') {
  return `
  <div class="kpi">
    <span class="k-label">${label}</span>
    <span class="k-value" x-text="${value}"></span>
    ${note ? `<span class="k-note" x-text="${note}"></span>` : ''}
  </div>`;
}

export function kpis(items, cls = '') {
  return `
  <div class="kpis ${cls}">${items.map((i) => kpi(...i)).join('')}</div>
  <p class="sr-only" aria-live="polite" x-text="live"></p>`;
}

export function legend(items) {
  return `<ul class="legend">${items.map((i) => `<li>${legendSwatch(i)}${i.label}</li>`).join('')}</ul>`;
}

export function dataTable(id) {
  return `
  <details>
    <summary>Ver datos de la gráfica</summary>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><template x-for="(c, j) in (v.tables?.${id}?.cols || [])" :key="j"><th scope="col" x-text="c"></th></template></tr></thead>
        <tbody><template x-for="(r, i) in (v.tables?.${id}?.rows || [])" :key="i"><tr><template x-for="(c, j) in r" :key="j"><td x-text="c"></td></template></tr></template></tbody>
      </table>
    </div>
  </details>`;
}

/** Tarjeta de gráfica con canvas accesible, leyenda HTML y tabla alternativa. */
export function chartCard({ id, title, legendItems = [], headExtra = '', note = '', after = '', table = true, height = '' }) {
  return `
  <section class="card" aria-labelledby="${id}-title">
    <div class="card-head">
      <h2 id="${id}-title">${title}</h2>
      ${legendItems.length ? legend(legendItems) : ''}${headExtra}
    </div>
    <div class="chart-box"${height ? ` style="height:${height}"` : ''}><canvas x-ref="${id}" role="img" :aria-label="v.alt?.${id} || '${js(title)}'"></canvas></div>
    ${note ? `<span class="chart-note">${note}</span>` : ''}
    ${after}
    ${table ? dataTable(id) : ''}
  </section>`;
}

const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 L13 8 L4 14 Z" fill="currentColor"></path></svg>';
const ICON_PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"></rect><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"></rect></svg>';

export function runbar(hint) {
  return `
  <div class="runbar">
    <button class="btn btn-primary" type="button" @click="toggleRun()">
      <span x-show="run.running" style="display:inline-flex">${ICON_PAUSE}</span><span x-show="!run.running" style="display:inline-flex">${ICON_PLAY}</span>
      <span x-text="runPrimary()"></span>
    </button>
    <button class="btn" type="button" @click="stepRun()" :disabled="run.running || run.k >= run.N">Paso</button>
    <button class="btn" type="button" @click="resetRun()" :disabled="run.k === 0 && !run.running">Reiniciar</button>
    <div class="progress" :class="{ paused: runStatus() === 'paused' }" aria-hidden="true"><div :style="'width:' + (100 * run.k / Math.max(1, run.N)).toFixed(1) + '%'"></div></div>
    <span class="hint">${hint}</span>
  </div>`;
}

export function scenariosBlock() {
  return `
  <div class="scenarios card" style="border:0;padding:14px 0 0;border-top:1px solid var(--line-soft);border-radius:0">
    <h3>Escenarios guardados</h3>
    <template x-if="!myScenarios().length">
      <p class="hint">Aún no hay escenarios. «Guardar escenario» conserva estos parámetros y la semilla en este navegador.</p>
    </template>
    <ul>
      <template x-for="(s, i) in myScenarios()" :key="s.savedAt + '-' + i">
        <li>
          <span x-text="s.name + ' · semilla ' + s.seed" :title="s.name"></span>
          <span class="actions">
            <button class="btn btn-sm" type="button" @click="loadScenario(s)" :aria-label="'Cargar escenario ' + s.name">Cargar</button>
            <button class="btn btn-sm" type="button" @click="$store.app.deleteScenario(route, i)" :aria-label="'Borrar escenario ' + s.name">Borrar</button>
          </span>
        </li>
      </template>
    </ul>
  </div>`;
}

/**
 * Secciones «Modelo», «Utilidad en los negocios» y «Parámetros y sus efectos».
 * model = { title?, formulas: [tex], tex, notes: [html], pre?: html }
 */
export function explain({ model, uses, params }) {
  return `
  <div class="explain-grid">
    <details class="explain" open>
      <summary><h2>${model.title ?? 'Modelo'}</h2></summary>
      <div class="explain-body">
        ${model.pre ?? ''}
        <div class="formulas">${model.formulas.map((t) => `<div data-tex="${esc(t)}"></div>`).join('')}</div>
        <code class="tex-src">${esc(model.tex)}</code>
        ${(model.notes ?? []).map((n) => `<p>${n}</p>`).join('')}
      </div>
    </details>
    <details class="explain" open>
      <summary><h2>Utilidad en los negocios</h2></summary>
      <div class="explain-body"><ul>${uses.map((u) => `<li>${u}</li>`).join('')}</ul></div>
    </details>
  </div>
  <details class="explain" open>
    <summary><h2>Parámetros y sus efectos</h2></summary>
    <div class="explain-body">
      <div class="ptable-wrap">
        <table class="ptable">
          <thead><tr><th scope="col">Símbolo</th><th scope="col">Significado</th><th scope="col">Si aumenta…</th></tr></thead>
          <tbody>${params.map(([s, m, e]) => `<tr><td>${s}</td><td>${m}</td><td>${e}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  </details>`;
}

/* ---------------- Fábrica de vistas ---------------- */
/**
 * def = {
 *   route, schema, dynamic?, unit?, ms?,
 *   state?() → estado reactivo extra,
 *   compute(params, seed, view) → resultado (no reactivo),
 *   total?(res, params) → N,
 *   present(res, params, k, view) → objeto `v` para la plantilla,
 *   charts?(res, params, k, view) → { [ref]: spec },
 *   live?(v) → texto para lectores de pantalla,
 *   shouldPause?(view, k), methods?, mounted?(view), unmounted?(view)
 * }
 */
export function defineView(def) {
  return () => {
    let res = null;
    let runner = null;
    let raf = 0;
    let liveTimer = 0;
    const charts = {};
    const app = () => window.Alpine.store('app');

    return {
      route: def.route,
      params: readParams(def.schema, routeState.query),
      run: { k: 0, N: 1, running: false },
      v: {},
      live: '',
      ...(def.state ? def.state() : {}),

      init() {
        this.compute();
        if (def.dynamic) this.run.k = def.initialK ? def.initialK(this) : this.run.N; // al cargar: Completada
        runner = createRunner(this.run, {
          ms: def.ms ?? 200,
          onChange: () => this.render(),
          shouldPause: def.shouldPause ? (k) => def.shouldPause(this, k) : null,
        });
        this.v = def.present(res, this.plain(), def.dynamic ? this.run.k : null, this);
        this.$watch('params', () => this.changed());
        this.$watch('$store.app.seed', () => this.changed());
        this.$watch('run.running', (r) => { app().running = r; });
        app().current = {
          route: def.route,
          params: () => this.plain(),
          load: (p, seed) => this.applyScenario(p, seed),
          flush: () => this.writeUrl(true),
        };
        this.writeUrl();
        this.$nextTick(() => {
          if (matchMedia('(max-width: 639px)').matches) this.$el.querySelectorAll('details.explain').forEach((d) => (d.open = false));
          renderMath(this.$el);
          this.render();
          def.mounted?.(this);
        });
      },

      destroy() {
        runner?.destroy();
        cancelAnimationFrame(raf);
        clearTimeout(liveTimer);
        Object.values(charts).forEach((c) => c?.destroy());
        def.unmounted?.(this);
        if (app().current?.route === def.route) app().current = null;
        app().running = false;
      },

      plain() { return JSON.parse(JSON.stringify(this.params)); },
      seed() { return app().seed; },

      compute() {
        res = def.compute(this.plain(), this.seed(), this);
        if (def.dynamic) this.run.N = Math.max(1, def.total(res, this.plain()));
      },

      changed() {
        const wasRunning = this.run.running;
        const mid = this.run.k > 0 && this.run.k < this.run.N;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const prevN = this.run.N;
          const wasDone = this.run.k >= prevN;
          this.compute();
          if (def.dynamic && def.adjustRun?.(this, { wasRunning, mid, wasDone, runner })) {
            // la vista decidió el nuevo estado del runner
          } else if (def.dynamic) {
            if (wasRunning || mid) {
              runner.stop();
              this.run.k = 0;
              if (wasRunning) runner.play();
            } else if (wasDone) {
              this.run.k = this.run.N;
            } else {
              this.run.k = Math.min(this.run.k, this.run.N);
            }
          }
          this.render();
          this.writeUrl();
        });
      },

      render() {
        const p = this.plain();
        const k = def.dynamic ? this.run.k : null;
        this.v = def.present(res, p, k, this);
        if (def.charts) {
          const specs = def.charts(res, p, k, this, this.v);
          for (const [ref, spec] of Object.entries(specs)) {
            const canvas = this.$refs[ref];
            if (canvas) charts[ref] = upsertChart(charts[ref], canvas, spec);
          }
        }
        clearTimeout(liveTimer);
        if (def.live) liveTimer = setTimeout(() => { this.live = def.live(this.v, this); }, 400);
      },

      writeUrl(now = false) {
        const qs = serialize(def.schema, this.plain(), this.seed());
        scheduleUrl(def.route, qs);
        if (now) flushUrl();
      },

      setExact(id, value) {
        const s = def.schema[id];
        if (!s || value === '' || value === null || !Number.isFinite(Number(value))) return;
        this.params[id] = coerce(s, value);
        def.onSet?.(this, id);
      },

      applyScenario(p, seed) {
        runner?.stop();
        const next = readParams(def.schema, p);
        def.beforeLoad?.(this, next);
        Object.assign(this.params, next);
        app().seed = seed;
      },
      loadScenario(s) { this.applyScenario(s.params, s.seed); app().notify(`Escenario «${s.name}» cargado`); },
      myScenarios() { return app().scenarios[def.route] || []; },

      // barra de ejecución
      runStatus() { return status(this.run); },
      runText() { return statusLabel(this.run, def.unit ?? 'paso'); },
      runPrimary() { return primaryLabel(this.run); },
      toggleRun() { def.beforePlay?.(this); runner.toggle(); def.afterPlay?.(this); },
      stepRun() { runner.step(); },
      resetRun() { runner.reset(); },
      stopRun() { runner?.stop(); },
      runnerApi() { return runner; },
      fx,
      money,
      ...(def.methods ?? {}),
    };
  };
}
