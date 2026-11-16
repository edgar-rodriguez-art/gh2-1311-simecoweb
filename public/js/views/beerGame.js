// #/beer-game
import * as bg from '../sims/beerGame.js';
import { sampleVariance } from '../sims/rng.js';
import { defineView, viewHead, slider, selectField, group, kpis, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, tokens } from '../ui/charts.js';
import { prefersReducedMotion } from '../ui/runner.js';

const route = 'beer-game';
const NAMES = bg.ROLES;
const COLORS = ['#1D4ED8', '#C2410C', '#0F766E', '#6D28D9'];
const DASHES = ['solid', 'dash', 'dot', 'dashdot'];
const schema = {
  role: { def: -1, type: 'enum', options: [-1, 0, 1, 2, 3] },
  dm: { def: 'poisson', type: 'enum', options: ['poisson', 'escalon'] },
  lambda: { def: 4, min: 2, max: 12, step: 1 },
  alpha: { def: 0.3, min: 0, max: 1, step: 0.05 },
  beta: { def: 0.3, min: 0, max: 1, step: 0.05 },
  theta: { def: 0.25, min: 0.05, max: 1, step: 0.05 },
  weeks: { def: 36, min: 20, max: 52, step: 1 },
};
const toSim = (p) => ({ demandMode: p.dm, lambda: p.lambda, alpha: p.alpha, beta: p.beta, theta: p.theta, weeks: p.weeks });

/** Estado tras k semanas, con los pedidos del jugador en su rol. */
function simulate(p, seed, k, hOrders) {
  let st = bg.init(toSim(p), seed);
  for (let w = 0; w < k && w < p.weeks; w++) {
    st = bg.step(st, p.role >= 0 && hOrders[w] != null ? { [p.role]: hOrders[w] } : {});
  }
  return st;
}

/* ---------- Animación SVG de la cadena (rAF) ---------- */
// Orden visual, de izquierda a derecha: Fábrica → Distribuidor → Mayorista → Minorista → Clientes.
const POS_X = (pos) => 76 + pos * 152;
const posOf = (role) => 3 - role; // clientes = 4
const animState = new WeakMap();

function animateWeek(view, rec, ms) {
  const g = view.$refs.flow;
  if (!g || !rec || prefersReducedMotion()) return;
  const prev = animState.get(view);
  if (prev) cancelAnimationFrame(prev.raf);
  while (g.firstChild) g.firstChild.remove();
  const NS = 'http://www.w3.org/2000/svg';
  const tokens = [];
  const mk = (x0, x1, y, label, fill, stroke) => {
    const el = document.createElementNS(NS, 'g');
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', -15); r.setAttribute('y', -9); r.setAttribute('width', 30); r.setAttribute('height', 18); r.setAttribute('rx', 4);
    r.setAttribute('fill', fill); r.setAttribute('stroke', stroke); r.setAttribute('stroke-width', 1.5);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central'); t.setAttribute('font-size', 12);
    t.setAttribute('font-family', 'JetBrains Mono, monospace'); t.setAttribute('font-weight', 600); t.setAttribute('fill', '#0F172A');
    t.textContent = label;
    el.append(r, t); g.append(el);
    tokens.push({ el, x0, x1, y });
  };
  // envíos → (hacia el cliente)
  for (let r = 0; r < 4; r++) mk(POS_X(posOf(r)) + 40, POS_X(posOf(r) + 1) - 40, 92, rec.shipped[r], '#FDBA74', '#C2410C');
  // pedidos ← (hacia la fábrica); la demanda del cliente llega al minorista
  mk(POS_X(4) - 40, POS_X(3) + 40, 116, rec.d, '#DBEAFE', '#1D4ED8');
  for (let r = 0; r < 3; r++) mk(POS_X(posOf(r)) - 40, POS_X(posOf(r) - 1) + 40, 116, rec.ord[r], '#DBEAFE', '#1D4ED8');
  mk(POS_X(0) - 40, 18, 116, rec.ord[3], '#DBEAFE', '#1D4ED8');
  const start = performance.now();
  const dur = Math.max(250, ms * 0.9);
  const frame = (now) => {
    const u = Math.min(1, (now - start) / dur);
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    for (const tk of tokens) tk.el.setAttribute('transform', `translate(${(tk.x0 + (tk.x1 - tk.x0) * e).toFixed(1)} ${tk.y})`);
    if (u < 1) animState.set(view, { raf: requestAnimationFrame(frame) });
    else setTimeout(() => { if (g.isConnected) tokens.forEach((tk) => tk.el.remove()); }, 150);
  };
  animState.set(view, { raf: requestAnimationFrame(frame) });
}

const def = {
  route, schema, dynamic: true, unit: 'semana', ms: 400,
  state: () => ({ hOrders: {}, draft: null, lastRole: null, lastK: null }),
  initialK: (view) => (view.params.role >= 0 ? 0 : view.run.N),
  compute(p, seed) { return { p, seed }; },
  total: (res, p) => p.weeks,
  shouldPause: (view, k) => view.params.role >= 0 && k < view.run.N,
  adjustRun(view, { runner }) {
    const role = view.params.role;
    const roleChanged = view.lastRole !== null && view.lastRole !== role;
    view.lastRole = role;
    if (role >= 0) {
      runner.stop(); view.hOrders = {}; view.draft = null; view.run.k = 0;
      return true;
    }
    if (roleChanged) { runner.stop(); view.hOrders = {}; view.run.k = view.run.N; return true; }
    return false;
  },
  beforePlay(view) {
    if (view.params.role >= 0 && view.run.k >= view.run.N) { view.hOrders = {}; view.draft = null; }
  },
  afterPlay(view) {
    if (view.params.role >= 0) view.$nextTick(() => view.$refs.turnInput?.focus());
  },
  mounted(view) { view.lastRole = view.params.role; },
  unmounted(view) { const s = animState.get(view); if (s) cancelAnimationFrame(s.raf); },
  methods: {
    submitOrder() {
      const k = this.run.k;
      if (this.params.role < 0 || k >= this.run.N) return;
      const val = Number(this.draft ?? this.v.play.hint);
      this.hOrders = { ...this.hOrders, [k]: Math.max(0, Math.round(Number.isFinite(val) ? val : this.v.play.hint)) };
      this.draft = null;
      this.runnerApi().step();
      this.$nextTick(() => this.$refs.turnInput?.focus());
    },
    stepRun() {
      const k = this.run.k;
      if (this.params.role >= 0 && k < this.run.N) this.hOrders = { ...this.hOrders, [k]: this.v.play.hint };
      this.draft = null;
      this.runnerApi().step();
    },
    resetRun() { this.hOrders = {}; this.draft = null; this.runnerApi().reset(); },
  },
  present(res, p, k, view) {
    const st = simulate(p, res.seed, k, view.hOrders);
    const hist = st.history;
    const last = hist[hist.length - 1];
    const sum = bg.summarize(st);
    const vd = sampleVariance(hist.map((r) => r.d)) || 1;
    const amp = hist.length > 1 ? sampleVariance(hist.map((r) => r.ord[3])) / vd : 0;
    const iv = hist.flatMap((r) => r.inv);
    const worst = iv.length ? Math.min(...iv) : bg.S_STAR;
    const wi = hist.findIndex((r) => r.inv.includes(worst));
    const peak = Math.max(0, ...hist.flatMap((r) => r.ord));
    const human = p.role;
    const pend = human >= 0 && k < p.weeks ? bg.pending(st, human) : null;
    const nodes = [3, 2, 1, 0].map((r) => {
      const inv = last ? last.inv[r] : bg.S_STAR;
      return {
        r, name: NAMES[r], human: r === human, ring: r === human ? '#1D4ED8' : COLORS[r], inv,
        invColor: inv < 0 ? '#B91C1C' : '#0F172A', invLabel: inv < 0 ? 'cajas pendientes' : 'cajas en inventario',
        order: last ? last.ord[r] : '—', cost: fx(sum.costByRole[r], 2), pipe: st.roles[r].ship.join(' + '),
      };
    });
    if (k !== view.lastK && last && view.lastK !== null && k === view.lastK + 1) animateWeek(view, last, view.run.running ? def.ms : 600);
    view.lastK = k;
    return {
      hist, nodes, wk: k, demNow: last ? last.d : '—',
      play: pend ? { on: true, role: NAMES[human], week: k + 1, incoming: pend.incoming, inv: pend.inv, sl: pend.outstanding, pipe: pend.pipeline, hint: pend.hint } : { on: false, hint: 0 },
      k: {
        total: '$' + fx(sum.totalCost, 2), totalNote: NAMES.map((n, i) => n.slice(0, 3) + ' ' + fx(sum.costByRole[i], 0)).join(' · '),
        amp: '×' + fx(amp, 2), ampNote: 'Var(pedidos fábrica) / Var(demanda)',
        worst: String(worst), worstNote: wi >= 0 ? NAMES[hist[wi].inv.indexOf(worst)] + ', semana ' + hist[wi].w : '—',
        peak: peak + ' cajas', peakNote: 'Demanda máxima ' + Math.max(0, ...hist.map((r) => r.d)),
      },
      alt: {
        c1: 'Pedidos semanales de cada rol frente a la demanda de los clientes; la varianza de la fábrica es ×' + fx(amp, 2) + ' la de la demanda.',
        c2: 'Inventario neto por rol; los valores negativos son pedidos pendientes. Peor valor: ' + worst + '.',
      },
      tables: {
        c1: { cols: ['Sem.', 'Demanda', ...NAMES], rows: hist.map((r) => [r.w, r.d, ...r.ord]) },
        c2: { cols: ['Sem.', 'Demanda', 'Minor.', 'Mayor.', 'Distr.', 'Fábr.'], rows: hist.map((r) => [r.w, r.d, ...r.inv]) },
      },
    };
  },
  charts(res, p, k, view, v) {
    const t = tokens();
    const hist = v.hist;
    const W = p.weeks;
    const oMax = Math.max(8, ...hist.flatMap((r) => r.ord), ...hist.map((r) => r.d)) * 1.1;
    const iv = hist.flatMap((r) => r.inv);
    const iMin = Math.min(-5, ...iv) * 1.1, iMax = Math.max(15, ...iv) * 1.1;
    const pts = (get) => hist.map((r) => ({ x: r.w, y: get(r) }));
    return {
      c1: {
        datasets: [
          ...[3, 2, 1, 0].map((i) => line(NAMES[i], pts((r) => r.ord[i]), { color: COLORS[i], dash: DASHES[i], width: 2.5 })),
          line('Clientes', pts((r) => r.d), { color: t.ref, width: 2 }),
        ],
        x: { min: 0, max: W, title: 'Semana', tipDigits: 0 }, y: { min: 0, max: oMax, title: 'Cajas pedidas', tipDigits: 0 },
      },
      c2: {
        datasets: [
          { ...line('Cero', [{ x: 0, y: 0 }, { x: W, y: 0 }], { color: t.ref, width: 1.5 }), noTooltip: true },
          ...[3, 2, 1, 0].map((i) => line(NAMES[i], pts((r) => r.inv[i]), { color: COLORS[i], dash: DASHES[i], width: 2.5 })),
        ],
        x: { min: 0, max: W, title: 'Semana', tipDigits: 0 }, y: { min: iMin, max: iMax, title: 'Inventario neto (cajas)', tipDigits: 0 },
      },
    };
  },
  live: (v) => `Semana ${v.wk}. Costo total ${v.k.total}. Amplificación en la fábrica ${v.k.amp}.` + (v.play.on ? ` Tu turno: recibiste ${v.play.incoming} cajas, sugerencia ${v.play.hint}.` : ''),
};

function svgChain() {
  const nodes = [3, 2, 1, 0].map((r, i) => `
      <g transform="translate(${POS_X(i)} 40)">
        <rect x="-60" y="-28" width="120" height="56" rx="10" fill="#FFFFFF" :stroke="params.role === ${r} ? '#1D4ED8' : '${COLORS[r]}'" stroke-width="3"></rect>
        <text y="-9" text-anchor="middle" font-size="13" font-weight="600" fill="#0F172A" font-family="Inter, sans-serif">${NAMES[r]}</text>
        <text y="14" text-anchor="middle" font-size="16" font-weight="600" font-family="JetBrains Mono, monospace" :fill="(v.nodes?.[${i}]?.inv ?? 0) < 0 ? '#B91C1C' : '#0F172A'" x-text="v.nodes?.[${i}]?.inv"></text>
        <g x-show="params.role === ${r}"><rect x="34" y="-38" width="32" height="18" rx="9" fill="#1D4ED8"></rect><text x="50" y="-29" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif">TÚ</text></g>
      </g>`).join('');
  return `
    <svg class="beer-svg" viewBox="0 0 760 132" aria-hidden="true">
      <line x1="40" y1="92" x2="720" y2="92" stroke="#334155" stroke-width="1" stroke-dasharray="3 4"></line>
      <line x1="40" y1="116" x2="720" y2="116" stroke="#334155" stroke-width="1" stroke-dasharray="3 4"></line>
      <text x="8" y="96" font-size="11" fill="#FDBA74" font-family="Inter, sans-serif">→</text>
      <text x="8" y="120" font-size="11" fill="#93C5FD" font-family="Inter, sans-serif">←</text>
      ${nodes}
      <g transform="translate(${POS_X(4)} 40)">
        <rect x="-60" y="-28" width="120" height="56" rx="10" fill="#0F172A" stroke="#475569" stroke-width="2"></rect>
        <text y="-9" text-anchor="middle" font-size="13" font-weight="600" fill="#CBD5E1" font-family="Inter, sans-serif">Clientes</text>
        <text y="14" text-anchor="middle" font-size="16" font-weight="600" fill="#F8FAFC" font-family="JetBrains Mono, monospace" x-text="v.demNow"></text>
      </g>
      <g x-ref="flow"></g>
    </svg>`;
}

function template() {
  return `
<div class="view" x-data="viewBeerGame">
  ${viewHead({
    cat: 'Cadena de suministro', module: 'js/sims/beerGame.js', title: 'Beer Game (versión simplificada)', dynamic: true,
    desc: 'Cuatro roles —minorista, mayorista, distribuidor y fábrica— deciden cada semana cuánto pedir, sin ver la demanda final. Los pedidos tardan 1 semana en llegar al proveedor y los envíos 2 semanas en llegar al cliente. Juega un rol o deja que todos sigan la regla de anclaje y ajuste.',
  })}
  <section class="beer-chain" aria-labelledby="chain-title">
    <div class="card-head">
      <h2 id="chain-title" x-text="'Cadena en la semana ' + v.wk"></h2>
      <span>Mercancía fluye → hacia el cliente · pedidos fluyen ← hacia la fábrica</span>
    </div>
    ${svgChain()}
    <div class="beer-nodes">
      <template x-for="n in v.nodes" :key="n.r">
        <div class="beer-node" :style="'border-color:' + n.ring">
          <div class="top"><strong x-text="n.name" style="font-size:14px"></strong><span class="badge" x-show="n.human">TÚ</span></div>
          <span class="inv" :style="'color:' + n.invColor" x-text="n.inv"></span>
          <small x-text="n.invLabel"></small>
          <small x-text="'En camino: ' + n.pipe"></small>
          <div class="foot"><span x-text="'Pidió ' + n.order"></span><span x-text="'Costo $' + n.cost"></span></div>
        </div>
      </template>
      <div class="beer-node customers">
        <span style="font-size:13px">Clientes</span>
        <span class="inv" x-text="v.demNow"></span>
        <small>cajas pedidas</small>
      </div>
    </div>
    ${runbar('Semana a semana')}
  </section>
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Configuración</h2>
      ${selectField({ id: 'role', label: 'Modo de juego', structural: true, options: [[-1, 'Automático (los 4 roles con la regla)'], [0, 'Juego como Minorista'], [1, 'Juego como Mayorista'], [2, 'Juego como Distribuidor'], [3, 'Juego como Fábrica']] })}
      ${selectField({ id: 'dm', label: 'Demanda del cliente', number: false, structural: true, options: [['poisson', 'Aleatoria · Poisson(λ) con semilla'], ['escalon', 'Escalón clásico · 4 → 8 en la semana 5']] })}
      ${slider({ id: 'lambda', label: 'Demanda media', sym: 'λ', unit: 'cajas', min: 2, max: 12, step: 1 })}
      ${group('Regla de decisión (roles automáticos)')}
      ${slider({ id: 'alpha', label: 'Ajuste del inventario', sym: 'α', unit: '', min: 0, max: 1, step: 0.05, digits: 2 })}
      ${slider({ id: 'beta', label: 'Peso de la línea de suministro', sym: 'β', unit: '', min: 0, max: 1, step: 0.05, digits: 2 })}
      ${slider({ id: 'theta', label: 'Suavizamiento del pronóstico', sym: 'θ', unit: '', min: 0.05, max: 1, step: 0.05, digits: 2 })}
      ${slider({ id: 'weeks', label: 'Semanas', sym: 'N', unit: 'sem', min: 20, max: 52, step: 1, structural: true })}
      ${scenariosBlock()}
    </section>
    <div class="results">
      <template x-if="v.play.on">
        <section class="turn" aria-labelledby="play-title">
          <div class="info">
            <h2 id="play-title" x-text="'Tu turno · ' + v.play.role + ' · semana ' + v.play.week"></h2>
            <span x-text="'Recibiste un pedido de ' + v.play.incoming + ' cajas. Inventario neto: ' + v.play.inv + '. En camino hacia ti: ' + v.play.sl + ' (envíos: ' + v.play.pipe + ').'"></span>
          </div>
          <label>Tu pedido esta semana
            <input type="number" min="0" step="1" x-ref="turnInput" :value="draft ?? v.play.hint" @input="draft = $event.target.value === '' ? null : Number($event.target.value)" @keydown.enter.prevent="submitOrder()">
          </label>
          <button class="btn btn-primary" type="button" @click="submitOrder()">Enviar pedido</button>
          <span class="full" x-text="'Sugerencia de la regla: ' + v.play.hint + ' cajas. «Paso» usa la sugerencia.'"></span>
        </section>
      </template>
      ${kpis([
        ['Costo total de la cadena', 'v.k.total', 'v.k.totalNote'],
        ['Amplificación en la fábrica', 'v.k.amp', 'v.k.ampNote'],
        ['Peor inventario neto', 'v.k.worst', 'v.k.worstNote'],
        ['Pedido máximo', 'v.k.peak', 'v.k.peakNote'],
      ])}
      ${chartCard({
        id: 'c1', title: 'Pedidos por rol',
        legendItems: [
          { label: 'Clientes', color: '#0F172A', width: 2 },
          { label: 'Minorista', color: '#1D4ED8' },
          { label: 'Mayorista', color: '#C2410C', dash: 'short' },
          { label: 'Distribuidor', color: '#0F766E', dash: 'dot', width: 2.5 },
          { label: 'Fábrica', color: '#6D28D9', dash: 'dashdot', width: 2.5 },
        ],
      })}
      ${chartCard({ id: 'c2', title: 'Inventario neto por rol (negativo = pedidos pendientes)', note: 'Valores: inventario neto al cierre de cada semana; la línea negra marca el cero.' })}
    </div>
  </div></div>
  ${explain({
    model: {
      title: 'Modelo y reglas del juego',
      pre: `<ol>
        <li>Llegan los envíos programados hace 2 semanas.</li>
        <li>Llega el pedido de tu cliente; surtes lo que puedas y el resto queda pendiente.</li>
        <li>Decides tu pedido; tu proveedor lo verá la próxima semana.</li>
        <li>Costo semanal: $0.50 por caja en inventario y $1.00 por caja pendiente.</li>
      </ol>`,
      formulas: [
        'O_t = \\max\\!\\left(0,\\ \\hat E_t + \\alpha\\left[(S^*-I_t) + \\beta(\\hat E_t\\,2 - SL_t)\\right]\\right)',
        '\\hat E_t = \\theta\\,D_t + (1-\\theta)\\,\\hat E_{t-1}',
      ],
      tex: 'O_t = \\max\\!\\left(0,\\ \\hat E_t + \\alpha\\left[(S^*-I_t) + \\beta(\\hat E_t\\,2 - SL_t)\\right]\\right)',
      notes: ['Ê = θ·D + (1 − θ)·Ê · S* = 12 cajas · inventario inicial 12 · líneas iniciales de λ. SL es lo pedido y aún no recibido (incluye los pendientes del proveedor).'],
    },
    uses: [
      'Vivir el pensamiento sistémico: los retrasos causan sobrerreacción aunque cada quien decida «bien».',
      'Mostrar el costo de ignorar lo que ya está en camino (β bajo): sobrepedidos y exceso de inventario.',
      'Taller para equipos de compras, logística y planeación de demanda (S&amp;OP).',
      'Comparar el costo total cuando la cadena comparte información o reduce retrasos.',
    ],
    params: [
      ['λ', 'Cajas que piden los clientes por semana (en promedio).', 'Más volumen; con la misma S* hay más riesgo de pendientes.'],
      ['α', 'Qué tan rápido se corrige la brecha de inventario.', 'Reacciones más bruscas y más oscilación.'],
      ['β', 'Cuánto se toma en cuenta lo pedido y no recibido.', 'β = 1 es racional y estabiliza; β bajo provoca sobrepedidos.'],
      ['θ', 'Peso del último pedido en el pronóstico.', 'Pronóstico más nervioso: amplifica el ruido.'],
      ['N', 'Semanas que dura el juego.', 'Más tiempo para que aparezcan y se amortigüen las oscilaciones.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewBeerGame', title: 'Beer Game', template, data: defineView(def) };
