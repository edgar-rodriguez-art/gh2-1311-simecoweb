// #/eoq
import * as sim from '../sims/eoq.js';
import { defineView, viewHead, slider, kpis, chartCard, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, marks, tokens } from '../ui/charts.js';

const route = 'eoq';
const DAYS = 360;
const schema = {
  D: { def: 1200, min: 100, max: 20000, step: 100 },
  S: { def: 50, min: 5, max: 500, step: 5 },
  H: { def: 2, min: 0.5, max: 50, step: 0.5 },
  Q: { def: null, min: 20, max: 2000, step: 5 }, // null → se usa round(Q*)
};

const def = {
  route, schema,
  methods: {
    qVal() { return this.params.Q ?? Math.round(sim.eoq(this.params)); },
    useOptimal() { this.params.Q = null; },
  },
  compute(p) {
    const s = sim.summary(p, DAYS);
    const qMax = Math.max(2000, s.Q * 1.1, s.Qs * 2.5);
    return { s, qMax, curve: sim.costCurve(p, 20, qMax, 80), sawOpt: sim.sawtooth(p, s.Qs, DAYS), sawMine: sim.sawtooth(p, s.Q, DAYS) };
  },
  present({ s }, p) {
    const rows = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((f) => {
      const q = s.Qs * f;
      return [fx(q, 0), '$' + fx(p.D / q * p.S, 2), '$' + fx(q / 2 * p.H, 2), '$' + fx(sim.totalCost(p, q), 2)];
    });
    return {
      k: {
        Qs: fx(s.Qs, 1), N: fx(s.N, 2), T: fx(s.T, 1) + ' días', TCs: '$' + fx(s.TCs, 2), TC: '$' + fx(s.TC, 2),
        pen: Math.abs(s.penalty) < 0.05 ? 'Estás en el óptimo' : '+' + fx(s.penalty, 1) + ' % sobre el óptimo',
      },
      alt: {
        c1: 'Curva de costo total en forma de U con mínimo en Q* = ' + fx(s.Qs, 1) + ' y costo $' + fx(s.TCs, 2) + '; tu Q = ' + fx(s.Q, 0) + ' cuesta $' + fx(s.TC, 2) + '.',
        c2: 'Inventario en diente de sierra: con Q* se hacen ' + fx(s.N, 1) + ' pedidos al año; con tu Q, ' + fx(s.ordersQ, 1) + '.',
      },
      tables: {
        c1: { cols: ['Q', 'Pedir', 'Mantener', 'Total'], rows },
        c2: { cols: ['Política', 'Lote', 'Pedidos/año', 'Inventario promedio'], rows: [['Q*', fx(s.Qs, 1), fx(s.N, 2), fx(s.Qs / 2, 1)], ['Tu Q', fx(s.Q, 0), fx(s.ordersQ, 2), fx(s.Q / 2, 1)]] },
      },
    };
  },
  charts({ s, qMax, curve, sawOpt, sawMine }, p) {
    const t = tokens();
    const yMax = Math.min(sim.totalCost(p, 20), sim.totalCost(p, qMax) * 1.6) * 1.05;
    const pts = (k) => curve.map((c) => ({ x: c.q, y: c[k] }));
    return {
      c1: {
        datasets: [
          line('Q*', [{ x: s.Qs, y: 0 }, { x: s.Qs, y: yMax }], { color: t.ref, dash: 'fine', width: 1.5 }),
          line('Pedir (D/Q)·S', pts('ordering'), { color: t.s2, dash: 'dash', width: 3 }),
          line('Mantener (Q/2)·H', pts('holding'), { color: t.s3, dash: 'dot', width: 2.5 }),
          line('Total', pts('total'), { color: t.s1, width: 3 }),
          marks('Tu Q', [{ x: s.Q, y: Math.min(s.TC, yMax) }], { color: t.danger, radius: 7, pointFill: '#FFFFFF', pointBorderWidth: 3 }),
        ],
        x: { min: 0, max: qMax, title: 'Cantidad por pedido Q (unidades)', tipDigits: 0 },
        y: { min: 0, max: yMax, title: 'Costo anual ($)', format: (v) => '$' + fx(v, 0) },
      },
      c2: {
        datasets: [
          line('Con Q*', sawOpt, { color: t.s1, width: 2.5 }),
          line('Con tu Q', sawMine, { color: t.danger, dash: 'short', width: 2.5 }),
        ],
        x: { min: 0, max: DAYS, title: 'Día del año', tipDigits: 0 },
        y: { min: 0, max: Math.max(s.Q, s.Qs) * 1.1, title: 'Unidades en inventario', tipDigits: 0 },
      },
    };
  },
  live: (v) => `Q* óptima ${v.k.Qs}. Costo total con Q* ${v.k.TCs}. Con tu Q ${v.k.TC}, ${v.k.pen}.`,
};

function template() {
  return `
<div class="view" x-data="viewEoq">
  ${viewHead({
    cat: 'Inventarios', module: 'js/sims/eoq.js', title: 'Cantidad económica de pedido (EOQ)',
    desc: 'Encuentra el tamaño de lote que minimiza la suma del costo de hacer pedidos y el costo de mantener inventario, suponiendo demanda constante y reposición instantánea. Mueve la cantidad elegida para ver cuánto cuesta alejarse del óptimo.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${slider({ id: 'D', label: 'Demanda anual', sym: 'D', unit: 'u/año', min: 100, max: 20000, step: 100 })}
      ${slider({ id: 'S', label: 'Costo por pedido', sym: 'S', unit: '$/pedido', min: 5, max: 500, step: 5 })}
      ${slider({ id: 'H', label: 'Costo de mantener', sym: 'H', unit: '$/u·año', min: 0.5, max: 50, step: 0.5, digits: 1 })}
      <div style="display:flex;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid var(--line-soft)">
        ${slider({ id: 'Q', label: 'Cantidad que pides', sym: 'Q', unit: 'u', min: 20, max: 2000, step: 5, value: 'qVal()', set: 'params.Q = $v' })}
        <button class="btn btn-outline-primary" type="button" style="align-self:flex-start" @click="useOptimal()" x-text="'Usar Q* = ' + v.k.Qs"></button>
      </div>
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${kpis([
        ['Q* óptima', 'v.k.Qs', "'unidades por pedido'"],
        ['Pedidos por año', 'v.k.N'],
        ['Tiempo entre pedidos', 'v.k.T'],
        ['Costo total con Q*', 'v.k.TCs'],
        ['Costo total con tu Q', 'v.k.TC', 'v.k.pen'],
      ])}
      ${chartCard({
        id: 'c1', title: 'Costos anuales según el tamaño del pedido',
        legendItems: [
          { label: 'Total', color: '#1D4ED8' },
          { label: 'Pedir (D/Q)·S', color: '#C2410C', dash: 'short' },
          { label: 'Mantener (Q/2)·H', color: '#0F766E', dash: 'dot', width: 2.5 },
          { label: 'Tu Q', color: '#B91C1C', kind: 'dot' },
        ],
        note: 'La línea punteada vertical marca Q*.',
      })}
      ${chartCard({
        id: 'c2', title: 'Inventario en el tiempo (diente de sierra)',
        legendItems: [
          { label: 'Con Q*', color: '#1D4ED8' },
          { label: 'Con tu Q', color: '#B91C1C', dash: 'short', width: 2.5 },
        ],
      })}
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        'Q^* = \\sqrt{\\frac{2DS}{H}}',
        'CT(Q) = \\frac{D}{Q}S + \\frac{Q}{2}H',
        'N = \\frac{D}{Q^*} \\qquad T = \\frac{Q^*}{D}\\cdot 360\\ \\text{días}',
      ],
      tex: 'Q^* = \\sqrt{\\frac{2DS}{H}}    CT(Q) = \\frac{D}{Q}S + \\frac{Q}{2}H',
      notes: ['En Q* el costo de pedir es igual al de mantener. La curva total es plana cerca del óptimo: pedir 20 % de más o de menos encarece apenas ~2 %.'],
    },
    uses: [
      'Definir lotes de compra de materias primas o mercadería con demanda estable.',
      'Justificar inversiones que bajan el costo de pedir (EDI, compras automáticas): reducen el lote y el inventario.',
      'Negociar con proveedores: saber cuánto cuesta aceptar un lote mínimo distinto de Q*.',
      'Punto de partida para modelos con descuentos por volumen o demanda variable.',
    ],
    params: [
      ['D', 'Unidades demandadas al año.', 'Q* crece con √D: el doble de demanda no duplica el lote (+41 %).'],
      ['S', 'Costo fijo de emitir, transportar y recibir un pedido.', 'Conviene pedir menos veces, en lotes más grandes.'],
      ['H', 'Costo de tener una unidad en almacén un año (capital, espacio, seguro, merma).', 'Conviene pedir lotes más pequeños y más seguido.'],
      ['Q', 'Lote que la empresa decide pedir.', 'Por encima de Q* domina el costo de mantener; por debajo, el de pedir.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewEoq', title: 'Cantidad económica de pedido', template, data: defineView(def) };
