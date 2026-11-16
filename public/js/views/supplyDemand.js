// #/oferta-demanda
import * as sim from '../sims/supplyDemand.js';
import { defineView, viewHead, slider, group, kpis, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, marks, tokens } from '../ui/charts.js';

const route = 'oferta-demanda';
const PERIODS = 30;
const schema = {
  a: { def: 120, min: 60, max: 200, step: 1 },
  b: { def: 3, min: 0.5, max: 6, step: 0.1 },
  c: { def: 0, min: -40, max: 0, step: 1 },
  d: { def: 2, min: 0.5, max: 6, step: 0.1 },
  t: { def: 0, min: 0, max: 20, step: 0.5 },
  pmax: { def: 0, min: 0, max: 60, step: 1 },
  p0: { def: 10, min: 0, max: 60, step: 1 },
};

const REGIME = {
  converge: { text: 'converge', color: '#166534' },
  cycle: { text: 'ciclo permanente', color: '#854D0E' },
  diverge: { text: 'diverge', color: '#B91C1C' },
};

const def = {
  route, schema, dynamic: true, unit: 'período', ms: 300,
  compute(p) {
    return {
      eq: sim.equilibrium(p),
      pc: sim.priceCeiling(p, p.pmax),
      cw: sim.cobweb(p, { P0: p.p0, periods: PERIODS }),
      cv: sim.curves(p),
    };
  },
  total: () => PERIODS,
  present({ eq, pc, cw }, p) {
    const { P, Q, Pp, cs, ps, revenue, dwl } = eq;
    const rg = REGIME[cw.regime];
    const rows = [];
    for (let i = 0; i <= 8; i++) { const pr = (p.a / p.b) * i / 8; rows.push(['$' + fx(pr, 2), fx(sim.demand(p, pr), 1), fx(sim.supply(p, pr, p.t), 1)]); }
    return {
      f: { pmax: p.pmax ? fx(p.pmax, 0) + ' $' : 'sin tope' },
      k: {
        P: '$' + fx(P, 2), Pnote: p.t > 0 ? 'Productor recibe $' + fx(Pp, 2) : 'Sin impuesto',
        Q: fx(Q, 1), cs: '$' + fx(cs, 0), ps: '$' + fx(ps, 0),
        tax: '$' + fx(revenue, 0) + ' · $' + fx(dwl, 0),
        short: pc.binding ? fx(pc.shortage, 1) : '—',
        shortNote: pc.binding ? 'Qd ' + fx(pc.Qd, 0) + ' vs Qs ' + fx(pc.Qs, 0) : 'El tope no es efectivo',
      },
      web: { label: cw.regime === 'cycle' ? 'd/b = 1 · ciclo permanente' : 'd/b = ' + fx(cw.ratio, 2) + ' · ' + rg.text, color: rg.color },
      alt: {
        c1: 'Demanda decreciente y oferta creciente que se cruzan en P* = $' + fx(P, 2) + ' y Q* = ' + fx(Q, 1) + ' unidades.',
        c2: 'Precio por período en el modelo de telaraña; el equilibrio es $' + fx(P, 2) + '. Régimen: ' + rg.text + '.',
      },
      tables: {
        c1: { cols: ['Precio', 'Qd', 'Qs'], rows },
        c2: { cols: ['Período', 'Precio', 'Qs'], rows: cw.path.map((s) => [s.k, '$' + fx(s.P, 2), s.Q == null ? '—' : fx(s.Q, 1)]) },
      },
    };
  },
  charts({ eq, pc, cw, cv }, p, k) {
    const t = tokens();
    const shown = cw.path.slice(0, k + 1);
    const web = [];
    for (let i = 1; i < shown.length; i++) web.push({ x: shown[i].Q, y: shown[i - 1].P }, { x: shown[i].Q, y: shown[i].P });
    const ds = [
      line('Demanda', cv.demand, { color: t.s1, width: 3 }),
      line('Oferta (con impuesto)', cv.supply, { color: t.s2, dash: 'dash', width: 3 }),
    ];
    if (p.t > 0) ds.push(line('Oferta sin impuesto', cv.supplyNoTax, { color: '#FDBA74', dash: [4, 4], width: 2 }));
    if (web.length) ds.push(line('Telaraña', web.filter((w) => w.y <= cv.pTop && w.x <= cv.qTop), { color: t.s3, dash: 'dot', width: 2.5 }));
    if (pc.binding) ds.push(line('Precio máximo P̄', [{ x: 0, y: p.pmax }, { x: cv.qTop, y: p.pmax }], { color: t.danger, width: 2 }));
    ds.push(marks('Equilibrio E', [{ x: eq.Q, y: eq.P }], { color: t.ref, radius: 6 }));
    const pTop2 = Math.min((Math.max(...cw.path.map((s) => s.P), eq.P) * 1.1) || 1, cv.pTop * 2);
    return {
      c1: { datasets: ds, x: { min: 0, max: cv.qTop, title: 'Cantidad (unidades)' }, y: { min: 0, max: cv.pTop, title: 'Precio ($)' } },
      c2: {
        datasets: [
          line('Equilibrio P*', [{ x: 0, y: eq.P }, { x: PERIODS, y: eq.P }], { color: t.axis, dash: [4, 4], width: 1.5 }),
          line('Precio', shown.map((s) => ({ x: s.k, y: Math.min(s.P, pTop2) })), { color: t.s3, width: 3, points: 2 }),
        ],
        x: { min: 0, max: PERIODS, title: 'Período', tipDigits: 0 }, y: { min: 0, max: pTop2, title: 'Precio ($)' },
      },
    };
  },
  live: (v) => `Precio de equilibrio ${v.k.P}, cantidad ${v.k.Q}. ${v.web.label}.`,
};

function template() {
  return `
<div class="view" x-data="viewSupplyDemand">
  ${viewHead({
    cat: 'Mercados', module: 'js/sims/supplyDemand.js', title: 'Oferta y demanda', dynamic: true,
    desc: 'Simula un mercado competitivo con curvas lineales: encuentra el precio y la cantidad de equilibrio, mide el efecto de un impuesto o de un precio máximo y muestra cómo el precio se ajusta período a período (modelo de la telaraña) cuando los productores deciden con el precio anterior.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${group('Demanda Qd = a − b·P', true)}
      ${slider({ id: 'a', label: 'Demanda máxima', sym: 'a', unit: 'u', min: 60, max: 200, step: 1 })}
      ${slider({ id: 'b', label: 'Sensibilidad al precio', sym: 'b', unit: 'u/$', min: 0.5, max: 6, step: 0.1, digits: 1 })}
      ${group('Oferta Qs = c + d·(P − t)')}
      ${slider({ id: 'c', label: 'Intercepto de oferta', sym: 'c', unit: 'u', min: -40, max: 0, step: 1 })}
      ${slider({ id: 'd', label: 'Respuesta de la oferta', sym: 'd', unit: 'u/$', min: 0.5, max: 6, step: 0.1, digits: 1 })}
      ${group('Intervenciones y dinámica')}
      ${slider({ id: 't', label: 'Impuesto por unidad', sym: 't', unit: '$/u', min: 0, max: 20, step: 0.5, digits: 1 })}
      <div class="slider" x-data="{ editing: false, draft: 0 }">
        <div class="slider-row">
          <label for="in-pmax">Precio máximo (0 = sin tope) <span class="sym">P̄</span></label>
          <button type="button" class="val-btn" x-show="!editing" @click="draft = params.pmax; editing = true; $nextTick(() => $refs.ed.select())" :aria-label="'Escribir valor exacto del precio máximo. Actual: ' + v.f?.pmax">
            <output for="in-pmax" aria-live="off" x-text="v.f?.pmax"></output>
          </button>
          <span class="val-edit" x-show="editing" x-cloak>
            <label class="sr-only" for="ed-pmax">Valor exacto del precio máximo</label>
            <input id="ed-pmax" x-ref="ed" type="number" min="0" max="60" step="any" x-model.number="draft" @keydown.enter.prevent="setExact('pmax', draft); editing = false" @keydown.escape.prevent="editing = false" @blur="if (editing) { setExact('pmax', draft); editing = false }">
          </span>
        </div>
        <input id="in-pmax" type="range" min="0" max="60" step="1" x-model.number="params.pmax" :aria-valuetext="v.f?.pmax">
        <div class="range-ends" aria-hidden="true"><span>0</span><span>60</span></div>
      </div>
      ${slider({ id: 'p0', label: 'Precio inicial de la telaraña', sym: 'P₀', unit: '$', min: 0, max: 60, step: 1 })}
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${kpis([
        ['Precio de equilibrio P*', 'v.k.P', 'v.k.Pnote'],
        ['Cantidad Q*', 'v.k.Q', "'unidades'"],
        ['Excedente consumidor', 'v.k.cs'],
        ['Excedente productor', 'v.k.ps'],
        ['Recaudo · pérdida irrecuperable', 'v.k.tax'],
        ['Escasez con precio máximo', 'v.k.short', 'v.k.shortNote'],
      ])}
      ${chartCard({
        id: 'c1', title: 'Curvas de oferta y demanda',
        legendItems: [
          { label: 'Demanda', color: '#1D4ED8' },
          { label: 'Oferta (con impuesto)', color: '#C2410C', dash: 'short' },
          { label: 'Telaraña', color: '#0F766E', dash: 'dot', width: 2.5 },
        ],
        note: '<span x-show="params.t > 0">Guiones claros: oferta original sin impuesto. </span><span x-show="v.k.short !== \'—\'">Línea roja: precio máximo P̄.</span>',
      })}
      ${chartCard({
        id: 'c2', title: 'Ajuste dinámico del precio (telaraña)',
        headExtra: '<span class="regime" :style="\'color:\' + v.web?.color" x-text="v.web?.label"></span>',
        after: runbar('Un período por paso'),
      })}
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        'P^* = \\frac{a - c + d\\,t}{b + d}',
        'Q^* = a - bP^*',
        'EC = \\tfrac12\\,Q^*\\left(\\tfrac{a}{b} - P^*\\right)',
        'EP = \\tfrac12\\,Q^*\\left(P^* - t + \\tfrac{c}{d}\\right)',
        'Q^s_k = c + d\\,(P_{k-1} - t), \\qquad P_k = \\frac{a - Q^s_k}{b}',
      ],
      tex: 'P^* = \\frac{a - c + d\\,t}{b + d}    Q^* = a - bP^*    P_k = \\frac{a - Q^s_k}{b}',
      notes: ['La telaraña converge si d/b &lt; 1, oscila sin fin si d/b = 1 y diverge si d/b &gt; 1.'],
    },
    uses: [
      'Fijar precios: estimar cuánto cae la venta si el precio sube (sensibilidad b).',
      'Evaluar el traslado de un impuesto: qué parte paga el cliente y qué parte absorbe la empresa.',
      'Anticipar escasez y mercados negros cuando se impone un precio máximo.',
      'Entender ciclos de precios en productos con tiempos de producción largos (agricultura, ganado, vivienda).',
    ],
    params: [
      ['a', 'Cantidad demandada si el precio fuera cero (tamaño del mercado).', 'La demanda se desplaza a la derecha: suben P* y Q*.'],
      ['b', 'Unidades que se dejan de comprar por cada $1 de aumento.', 'Demanda más sensible: bajan P* y Q*; la telaraña se estabiliza.'],
      ['c', 'Intercepto de la oferta (≤ 0: nadie produce a precios muy bajos).', 'Más oferta a cada precio: baja P*, sube Q*.'],
      ['d', 'Unidades adicionales ofrecidas por cada $1 de aumento.', 'Oferta más elástica; si d &gt; b la telaraña diverge.'],
      ['t', 'Impuesto por unidad cobrado al productor.', 'Sube el precio al consumidor, baja el del productor y aparece una pérdida irrecuperable ½·t·ΔQ.'],
      ['P̄', 'Precio máximo legal.', 'Si P̄ &lt; P*, la escasez Qd − Qs se reduce al acercarse a P*.'],
      ['P₀', 'Precio con el que arranca la telaraña.', 'Cambia la amplitud inicial de la oscilación, no el régimen.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewSupplyDemand', title: 'Oferta y demanda', template, data: defineView(def) };
