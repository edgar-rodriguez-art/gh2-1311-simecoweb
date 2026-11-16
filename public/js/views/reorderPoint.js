// #/punto-reorden
import * as sim from '../sims/reorderPoint.js';
import { defineView, viewHead, slider, selectField, kpis, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, marks, tokens } from '../ui/charts.js';

const route = 'punto-reorden';
const schema = {
  dbar: { def: 20, min: 5, max: 100, step: 1 },
  sigma: { def: 5, min: 0, max: 30, step: 0.5 },
  L: { def: 4, min: 1, max: 30, step: 1 },
  sl: { def: 95, type: 'enum', options: [80, 85, 90, 95, 97.5, 99, 99.9] },
  Q: { def: 200, min: 50, max: 600, step: 10 },
  days: { def: 120, min: 30, max: 365, step: 5 },
};
const toSim = (p) => ({ ...p, sl: p.sl / 100 });

/** Serie escalonada: (t, h) → (t + 1, h). */
export function stepSeries(rows) {
  const out = rows.map((r) => ({ x: r.t, y: r.onHand }));
  if (rows.length) out.push({ x: rows[rows.length - 1].t + 1, y: rows[rows.length - 1].onHand });
  return out;
}

const def = {
  route, schema, dynamic: true, unit: 'día', ms: 50,
  compute(p, seed) { return sim.simulate(toSim(p), seed); },
  total: (res) => res.rows.length,
  present(res, p, k) {
    const shown = res.rows.slice(0, Math.max(1, k));
    const cur = shown[shown.length - 1];
    const avg = shown.reduce((a, r) => a + r.onHand, 0) / shown.length;
    const outDays = shown.filter((r) => r.stockout).length;
    return {
      k: {
        ss: fx(res.ss, 1) + ' u', z: 'z = ' + fx(res.z, 3),
        rop: fx(res.rop, 1) + ' u', ropNote: 'd̄·L = ' + fx(p.dbar * p.L, 0) + ' + SS',
        fill: fx(cur.total ? cur.served / cur.total * 100 : 100, 1) + ' %', lost: cur.lost + ' u perdidas',
        csl: fx(cur.cycles ? (1 - cur.bad / cur.cycles) * 100 : 100, 1) + ' %', cslNote: 'Objetivo ' + fx(p.sl, p.sl % 1 ? 1 : 0) + ' % · ' + cur.cycles + ' ciclos',
        avg: fx(avg, 1) + ' u', orders: cur.orders + ' pedidos',
      },
      alt: { c1: 'Inventario diario con ROP en ' + fx(res.rop, 1) + ' unidades; ' + cur.orders + ' pedidos y ' + outDays + ' días con faltante hasta el día ' + (cur.t + 1) + '.' },
      tables: { c1: { cols: ['Día', 'Demanda', 'A mano', 'Pedido', 'Faltante'], rows: shown.map((r) => [r.t + 1, r.demand, r.onHand, r.ordered || '—', r.stockout ? 'sí' : '—']) } },
    };
  },
  charts(res, p, k) {
    const t = tokens();
    const shown = res.rows.slice(0, Math.max(1, k));
    const yMax = Math.max(res.rop + p.Q, ...res.rows.map((r) => r.onHand)) * 1.08;
    return {
      c1: {
        datasets: [
          line('ROP', [{ x: 0, y: res.rop }, { x: p.days, y: res.rop }], { color: t.s2, dash: 'dash', width: 2.5 }),
          line('Inventario de seguridad', [{ x: 0, y: res.ss }, { x: p.days, y: res.ss }], { color: t.s3, dash: 'dot', width: 2.5 }),
          line('Inventario a mano', stepSeries(shown), { color: t.s1, width: 2.5, stepped: 'after' }),
          marks('Pedido', shown.filter((r) => r.ordered).map((r) => ({ x: r.t + 0.5, y: yMax * 0.03 })), { color: t.s4, pointStyle: 'line', pointRotation: 90, radius: 8, pointBorderWidth: 3 }),
          marks('Faltante', shown.filter((r) => r.stockout).map((r) => ({ x: r.t + 0.5, y: 0 })), { color: t.danger, pointStyle: 'rect', radius: 4 }),
        ],
        x: { min: 0, max: p.days, title: 'Día', tipDigits: 0 },
        y: { min: 0, max: yMax, title: 'Unidades a mano', tipDigits: 0 },
      },
    };
  },
  live: (v) => `Inventario de seguridad ${v.k.ss}, punto de reorden ${v.k.rop}, tasa de surtido ${v.k.fill}, ${v.k.lost}.`,
};

function template() {
  return `
<div class="view" x-data="viewReorderPoint">
  ${viewHead({
    cat: 'Inventarios', module: 'js/sims/reorderPoint.js', title: 'Punto de reorden con demanda variable', dynamic: true,
    desc: 'Simula día a día un inventario cuya demanda cambia al azar. Cuando la posición de inventario cae al punto de reorden (ROP) se pide un lote Q que llega tras el tiempo de entrega. El inventario de seguridad protege contra la variabilidad durante esa espera.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${slider({ id: 'dbar', label: 'Demanda diaria promedio', sym: 'd̄', unit: 'u/día', min: 5, max: 100, step: 1 })}
      ${slider({ id: 'sigma', label: 'Desviación de la demanda', sym: 'σd', unit: 'u/día', min: 0, max: 30, step: 0.5, digits: 1 })}
      ${slider({ id: 'L', label: 'Tiempo de entrega', sym: 'L', unit: 'días', min: 1, max: 30, step: 1 })}
      ${selectField({ id: 'sl', label: 'Nivel de servicio objetivo', sym: 'NS → z', options: [[80, '80 % (z = 0.84)'], [85, '85 % (z = 1.04)'], [90, '90 % (z = 1.28)'], [95, '95 % (z = 1.64)'], [97.5, '97.5 % (z = 1.96)'], [99, '99 % (z = 2.33)'], [99.9, '99.9 % (z = 3.09)']] })}
      ${slider({ id: 'Q', label: 'Tamaño del pedido', sym: 'Q', unit: 'u', min: 50, max: 600, step: 10 })}
      ${slider({ id: 'days', label: 'Días simulados', sym: 'N', unit: 'días', min: 30, max: 365, step: 5, structural: true })}
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${kpis([
        ['Inventario de seguridad', 'v.k.ss', 'v.k.z'],
        ['Punto de reorden', 'v.k.rop', 'v.k.ropNote'],
        ['Tasa de surtido (fill rate)', 'v.k.fill', 'v.k.lost'],
        ['Ciclos sin faltante', 'v.k.csl', 'v.k.cslNote'],
        ['Inventario promedio', 'v.k.avg', 'v.k.orders'],
      ])}
      ${chartCard({
        id: 'c1', title: 'Inventario a mano por día',
        legendItems: [
          { label: 'Inventario', color: '#1D4ED8' },
          { label: 'ROP', color: '#C2410C', dash: 'short' },
          { label: 'Seguridad', color: '#0F766E', dash: 'dot', width: 2.5 },
          { label: 'Pedido', color: '#6D28D9', kind: 'tick' },
          { label: 'Faltante', color: '#B91C1C', kind: 'rect' },
        ],
        after: runbar('Un día por paso · misma semilla, mismo resultado'),
      })}
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        'SS = z\\,\\sigma_d\\sqrt{L}',
        'ROP = \\bar d\\,L + z\\,\\sigma_d\\sqrt{L}',
        '\\text{Demanda}_t = \\max\\!\\big(0,\\ \\text{redondeo}(N(\\bar d, \\sigma_d))\\big)',
      ],
      tex: 'ROP = \\bar d\\,L + z\\,\\sigma_d\\sqrt{L}',
      notes: ['Regla diaria: llegan pedidos → se atiende la demanda (lo que no se surte se pierde) → si inventario a mano + en tránsito ≤ ROP, se pide Q, que llega en L días. El ciclo observado puede quedar bajo el objetivo porque el inventario suele cruzar el ROP con un sobrepaso de hasta un día de demanda.'],
    },
    uses: [
      'Decidir cuándo pedir en farmacias, supermercados o refacciones con demanda incierta.',
      'Cuantificar el costo de subir el nivel de servicio: de 95 % a 99 % el inventario de seguridad crece 41 %.',
      'Mostrar que acortar el tiempo de entrega o estabilizar la demanda libera capital de trabajo.',
      'Parametrizar alertas de reabastecimiento en un ERP o sistema de punto de venta.',
    ],
    params: [
      ['d̄', 'Demanda diaria esperada.', 'Sube el ROP en d̄·L; el inventario baja más rápido.'],
      ['σd', 'Variabilidad diaria de la demanda.', 'Se necesita más inventario de seguridad para el mismo servicio.'],
      ['L', 'Días desde que se pide hasta que llega.', 'Más demanda que cubrir y más incertidumbre (√L).'],
      ['NS', 'Probabilidad de no tener faltante en un ciclo.', 'z crece cada vez más rápido: el último punto de servicio es el más caro.'],
      ['Q', 'Unidades por pedido.', 'Menos pedidos y menos ciclos expuestos a faltantes, pero más inventario promedio.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewReorderPoint', title: 'Punto de reorden', template, data: defineView(def) };
