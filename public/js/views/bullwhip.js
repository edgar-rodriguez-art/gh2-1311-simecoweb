// #/efecto-latigo
import * as sim from '../sims/bullwhip.js';
import { defineView, viewHead, slider, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, tokens } from '../ui/charts.js';

const route = 'efecto-latigo';
const NAMES = ['Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
const COLORS = ['#1D4ED8', '#C2410C', '#0F766E', '#6D28D9'];
const DASHES = ['solid', 'dash', 'dot', 'dashdot'];
const schema = {
  mu: { def: 100, min: 50, max: 200, step: 5 },
  sigma: { def: 10, min: 0, max: 40, step: 1 },
  L: { def: 2, min: 1, max: 8, step: 1 },
  p: { def: 5, min: 2, max: 20, step: 1 },
  periods: { def: 52, min: 20, max: 104, step: 4 },
  share: { def: false, type: 'bool' },
};

const def = {
  route, schema, dynamic: true, unit: 'semana', ms: 120,
  compute(p, seed) { return sim.simulate(p, seed); },
  total: (res, p) => p.periods,
  present(res, p, k) {
    const n = Math.max(3, k);
    const m = sim.measure({ cust: res.customerAll, orders: res.ordersAll, L: p.L, p: p.p }, n);
    const bound = m.stageBound;
    const lmax = Math.log10(Math.max(...m.ratios, bound ** 4, 10));
    const w = (r) => Math.max(2, Math.log10(Math.max(1, r)) / lmax * 100).toFixed(1) + '%';
    return {
      m,
      bars: NAMES.map((nm, i) => ({ name: nm, r: fx(m.ratios[i], 2), w: w(m.ratios[i]), tw: w(p.share ? m.additiveBound[i] : m.cumulativeBound[i]), color: COLORS[i] })),
      chain: [{ name: 'Cliente', ratio: '×1.00', note: 'σ = ' + p.sigma, border: '#0F172A', bg: '#F8FAFC', arrow: true }]
        .concat(NAMES.map((nm, i) => ({ name: nm, ratio: '×' + fx(m.ratios[i], 2), note: 'cota ×' + fx(p.share ? m.additiveBound[i] : m.cumulativeBound[i], 2), border: COLORS[i], bg: '#FFFFFF', arrow: i < 3 }))),
      boundLabel: 'Cota por eslabón ×' + fx(bound, 2),
      barsAlt: 'Razón de varianzas por eslabón: ' + NAMES.map((nm, i) => nm + ' ' + fx(m.ratios[i], 2)).join(', ') + '.',
      alt: { c1: 'Pedidos semanales: la demanda del cliente varía poco y los pedidos de la fábrica oscilan ×' + fx(m.ratios[3], 1) + ' en varianza.' },
      tables: {
        c1: {
          cols: ['Semana', 'Cliente', ...NAMES],
          rows: m.customer.slice(0, Math.max(1, k)).map((c, i) => [i + 1, fx(c, 1), ...m.orders.map((o) => fx(o[i], 1))]),
        },
      },
    };
  },
  charts(res, p, k) {
    const t = tokens();
    const n = Math.max(1, k);
    const C = res.customerAll.slice(sim.WARMUP, sim.WARMUP + n);
    const O = res.ordersAll.map((q) => q.slice(sim.WARMUP, sim.WARMUP + n));
    const yMax = Math.max(...res.ordersAll.map((q) => Math.max(...q.slice(sim.WARMUP))), ...res.customerAll) * 1.05;
    const pts = (xs) => xs.map((y, i) => ({ x: i, y }));
    return {
      c1: {
        datasets: [
          ...[3, 2, 1, 0].map((i) => line(NAMES[i], pts(O[i]), { color: COLORS[i], dash: DASHES[i], width: 2.5 })),
          line('Cliente', pts(C), { color: t.ref, width: 2 }),
        ],
        x: { min: 0, max: p.periods, title: 'Semana', tipDigits: 0 },
        y: { min: 0, max: yMax, title: 'Unidades pedidas', tipDigits: 1 },
      },
    };
  },
  live: (v) => v.barsAlt + ' ' + v.boundLabel + '.',
};

function template() {
  return `
<div class="view" x-data="viewBullwhip">
  ${viewHead({
    cat: 'Cadena de suministro', module: 'js/sims/bullwhip.js', title: 'Efecto látigo (bullwhip effect)', dynamic: true,
    desc: 'Una cadena de cuatro eslabones atiende una demanda de consumidores casi estable. Cada eslabón pronostica con un promedio móvil de los pedidos que recibe y repone con una política de nivel objetivo. Observa cómo la variabilidad de los pedidos crece a medida que subes por la cadena.',
  })}
  <section class="chain" aria-label="Cadena de suministro">
    <template x-for="(n, i) in v.chain" :key="i">
      <div class="chain-item">
        <div class="chain-node" :style="'border-color:' + n.border + ';background:' + n.bg">
          <span class="name" x-text="n.name"></span>
          <span class="ratio" x-text="n.ratio"></span>
          <span class="note" x-text="n.note"></span>
        </div>
        <svg x-show="n.arrow" width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><path d="M2 8 H18 M12 2 L19 8 L12 14" fill="none" stroke="#94A3B8" stroke-width="2"></path></svg>
      </div>
    </template>
  </section>
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${slider({ id: 'mu', label: 'Demanda media del cliente', sym: 'μ', unit: 'u/sem', min: 50, max: 200, step: 5 })}
      ${slider({ id: 'sigma', label: 'Desviación de la demanda', sym: 'σ', unit: 'u/sem', min: 0, max: 40, step: 1 })}
      ${slider({ id: 'L', label: 'Tiempo de entrega por eslabón', sym: 'L', unit: 'sem', min: 1, max: 8, step: 1 })}
      ${slider({ id: 'p', label: 'Ventana del promedio móvil', sym: 'p', unit: 'sem', min: 2, max: 20, step: 1 })}
      ${slider({ id: 'periods', label: 'Semanas simuladas', sym: 'N', unit: 'sem', min: 20, max: 104, step: 4, structural: true })}
      <label class="switch">
        <input type="checkbox" x-model="params.share">
        <span><strong>Compartir información de venta</strong><small>Todos pronostican con la demanda real del cliente</small></span>
      </label>
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${chartCard({
        id: 'c1', title: 'Pedidos por eslabón en el tiempo',
        legendItems: [
          { label: 'Cliente', color: '#0F172A', width: 2 },
          { label: 'Minorista', color: '#1D4ED8' },
          { label: 'Mayorista', color: '#C2410C', dash: 'short' },
          { label: 'Distribuidor', color: '#0F766E', dash: 'dot', width: 2.5 },
          { label: 'Fábrica', color: '#6D28D9', dash: 'dashdot', width: 2.5 },
        ],
        after: runbar('Una semana por paso'),
      })}
      <section class="card" aria-labelledby="c2-title">
        <div class="card-head">
          <h2 id="c2-title">Amplificación de la varianza · Var(pedidos) / Var(demanda)</h2>
          <span class="regime" style="color:var(--ink-2)" x-text="v.boundLabel"></span>
        </div>
        <div class="ampbars" role="img" :aria-label="v.barsAlt">
          <template x-for="(b, i) in v.bars" :key="i">
            <div class="ampbar">
              <span class="name" x-text="b.name"></span>
              <div class="track">
                <div class="fill" :style="'width:' + b.w + ';background:' + b.color"></div>
                <div class="bound" :style="'left:' + b.tw"></div>
              </div>
              <span class="r" x-text="'×' + b.r"></span>
            </div>
          </template>
        </div>
        <p class="sr-only" aria-live="polite" x-text="live"></p>
        <span class="chart-note" x-show="!params.share">Escala logarítmica. La línea punteada marca la cota teórica acumulada (1 + 2L/p + 2L²/p²)<sup>k</sup>.</span>
        <span class="chart-note" x-show="params.share" x-cloak>Escala logarítmica. Con información compartida la línea punteada marca la cota aditiva 1 + k·(2L/p + 2L²/p²).</span>
      </section>
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        'F_t = \\frac{1}{p}\\sum_{i=0}^{p-1} D_{t-i}',
        'S_t = F_t\\,(L + 1)',
        'q_t = \\max\\left(0,\\ D_t + S_t - S_{t-1}\\right)',
        '\\frac{Var(q)}{Var(D)} \\ge 1 + \\frac{2L}{p} + \\frac{2L^2}{p^2}',
      ],
      tex: '\\frac{Var(q)}{Var(D)} \\ge 1 + \\frac{2L}{p} + \\frac{2L^2}{p^2}',
      notes: ['Cota de Chen, Drezner, Ryan y Simchi-Levi (2000). Con información compartida, la amplificación crece de forma aditiva y no multiplicativa. Las primeras 10 semanas son de calentamiento y no se miden.'],
    },
    uses: [
      'Explicar por qué la fábrica ve picos y caídas de pedidos que el consumidor nunca generó.',
      'Justificar compartir datos de punto de venta (VMI, CPFR) con proveedores.',
      'Reducir tiempos de entrega y usar pronósticos con más historia para suavizar pedidos.',
      'Dimensionar capacidad y producción en eslabones alejados del cliente.',
    ],
    params: [
      ['μ', 'Demanda semanal promedio del consumidor.', 'Escala todos los pedidos; la razón de varianzas casi no cambia.'],
      ['σ', 'Ruido de la demanda final.', 'Oscilaciones mayores; con σ = 0 no hay látigo.'],
      ['L', 'Semanas entre pedir y recibir en cada eslabón.', 'Amplificación mucho mayor (término 2L²/p²).'],
      ['p', 'Semanas usadas en el pronóstico.', 'Pronósticos más estables: menos látigo, reacción más lenta.'],
      ['Compartir', 'Cada eslabón ve la venta real al consumidor.', 'La fábrica deja de reaccionar a la distorsión acumulada.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewBullwhip', title: 'Efecto látigo', template, data: defineView(def) };
