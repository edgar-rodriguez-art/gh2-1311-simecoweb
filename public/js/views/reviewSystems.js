// #/sistemas-revision
import * as sim from '../sims/reviewSystems.js';
import { levels } from '../sims/reorderPoint.js';
import { defineView, viewHead, slider, selectField, group, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, marks, bars, tokens } from '../ui/charts.js';
import { stepSeries } from './reorderPoint.js';

const route = 'sistemas-revision';
const schema = {
  dbar: { def: 20, min: 5, max: 100, step: 1 },
  sigma: { def: 5, min: 0, max: 30, step: 0.5 },
  L: { def: 4, min: 1, max: 20, step: 1 },
  sl: { def: 95, type: 'enum', options: [90, 95, 97.5, 99] },
  Q: { def: 200, min: 50, max: 600, step: 10 },
  T: { def: 7, min: 1, max: 30, step: 1 },
  days: { def: 120, min: 30, max: 365, step: 5 },
};
const toSim = (p) => ({ ...p, sl: p.sl / 100 });

const def = {
  route, schema, dynamic: true, unit: 'día', ms: 50,
  compute(p, seed) {
    const q = toSim(p);
    return { ...sim.compare(q, seed), lv: levels(q) };
  },
  total: (res) => res.demand.length,
  present({ continuous: A, periodic: B, lv }, p, k) {
    const n = Math.max(1, k);
    const ca = A.rows[n - 1], cb = B.rows[n - 1];
    const pct = (r) => fx(r.total ? r.served / r.total * 100 : 100, 1) + ' %';
    return {
      cmp: [
        ['Nivel de disparo / máximo', 'ROP ' + fx(lv.rop, 1), 'S ' + fx(B.S, 1)],
        ['Inventario de seguridad', fx(A.ss, 1) + ' u', fx(B.ss, 1) + ' u'],
        ['Pedidos emitidos', String(ca.orders), String(cb.orders)],
        ['Inventario promedio', fx(ca.avg, 1) + ' u', fx(cb.avg, 1) + ' u'],
        ['Tasa de surtido', pct(ca), pct(cb)],
        ['Días con faltante', String(ca.stockoutDays), String(cb.stockoutDays)],
      ],
      alt: {
        c1: 'Inventario diario de ambas políticas con la misma demanda. Continua: ' + ca.orders + ' pedidos; periódica: ' + cb.orders + ' pedidos.',
        c2: 'Barras de pedidos: la continua pide siempre ' + p.Q + ' unidades; la periódica pide cantidades variables cada ' + p.T + ' días.',
      },
      tables: {
        c2: {
          cols: ['Día', 'Demanda', 'A mano continua', 'A mano periódica', 'Pedido continua', 'Pedido periódica'],
          rows: A.rows.slice(0, n).map((r, i) => [r.t + 1, r.demand, r.onHand, B.rows[i].onHand, r.ordered || '—', B.rows[i].ordered || '—']),
        },
      },
    };
  },
  charts({ continuous: A, periodic: B }, p, k) {
    const t = tokens();
    const n = Math.max(1, k);
    const a = A.rows.slice(0, n), b = B.rows.slice(0, n);
    const yMax = Math.max(...A.rows.map((r) => r.onHand), ...B.rows.map((r) => r.onHand), B.S) * 1.08;
    const rev = [];
    for (let d = p.T; d <= p.days; d += p.T) rev.push({ x: d, y: 0 }, { x: d, y: yMax }, { x: d, y: null });
    const oMax = Math.max(p.Q, ...B.rows.map((r) => r.ordered)) * 1.15 || 1;
    return {
      c1: {
        datasets: [
          { ...line('Día de revisión', rev, { color: '#CBD5E1', width: 1 }), noTooltip: true },
          line('Continua (Q, ROP)', stepSeries(a), { color: t.s1, width: 2.5, stepped: 'after' }),
          line('Periódica (T, S)', stepSeries(b), { color: t.s2, dash: 'dash', width: 2.5, stepped: 'after' }),
          marks('Faltante continua', a.filter((r) => r.stockout).map((r) => ({ x: r.t + 0.5, y: 0 })), { color: t.danger, pointStyle: 'rect', radius: 4 }),
          marks('Faltante periódica', b.filter((r) => r.stockout).map((r) => ({ x: r.t + 0.5, y: yMax * 0.025 })), { color: t.danger, pointStyle: 'triangle', radius: 4 }),
        ],
        x: { min: 0, max: p.days, title: 'Día', tipDigits: 0 },
        y: { min: 0, max: yMax, title: 'Unidades a mano', tipDigits: 0 },
      },
      c2: {
        type: 'bar',
        datasets: [
          bars('Continua (lote fijo)', a.filter((r) => r.ordered).map((r) => ({ x: r.t + 0.5 - 0.35, y: r.ordered })), { color: t.s1, thickness: 5 }),
          bars('Periódica (hasta S)', b.filter((r) => r.ordered).map((r) => ({ x: r.t + 0.5 + 0.35, y: r.ordered })), { color: t.s2, thickness: 5 }),
        ],
        x: { min: 0, max: p.days, title: 'Día del pedido', tipDigits: 0 },
        y: { min: 0, max: oMax, title: 'Unidades pedidas', tipDigits: 0 },
      },
    };
  },
  live: (v) => v.cmp.map((r) => `${r[0]}: continua ${r[1]}, periódica ${r[2]}`).join('. '),
};

function template() {
  return `
<div class="view" x-data="viewReviewSystems">
  ${viewHead({
    cat: 'Inventarios', module: 'js/sims/reviewSystems.js', title: 'Sistemas de revisión: continua vs. periódica', dynamic: true,
    desc: 'Compara dos políticas con exactamente la misma demanda diaria. En la revisión continua (Q, ROP) se vigila el inventario todo el tiempo y se pide un lote fijo. En la periódica (T, S) se revisa cada T días y se pide lo necesario para volver al nivel máximo S.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${group('Demanda y entrega (comunes)', true)}
      ${slider({ id: 'dbar', label: 'Demanda diaria promedio', sym: 'd̄', unit: 'u/día', min: 5, max: 100, step: 1 })}
      ${slider({ id: 'sigma', label: 'Desviación de la demanda', sym: 'σd', unit: 'u/día', min: 0, max: 30, step: 0.5, digits: 1 })}
      ${slider({ id: 'L', label: 'Tiempo de entrega', sym: 'L', unit: 'días', min: 1, max: 20, step: 1 })}
      ${selectField({ id: 'sl', label: 'Nivel de servicio objetivo', sym: 'NS', options: [[90, '90 % (z = 1.28)'], [95, '95 % (z = 1.64)'], [97.5, '97.5 % (z = 1.96)'], [99, '99 % (z = 2.33)']] })}
      ${group('Continua (Q, ROP)')}
      ${slider({ id: 'Q', label: 'Lote fijo', sym: 'Q', unit: 'u', min: 50, max: 600, step: 10 })}
      ${group('Periódica (T, S)')}
      ${slider({ id: 'T', label: 'Periodo de revisión', sym: 'T', unit: 'días', min: 1, max: 30, step: 1 })}
      ${slider({ id: 'days', label: 'Días simulados', sym: 'N', unit: 'días', min: 30, max: 365, step: 5, structural: true })}
      ${scenariosBlock()}
    </section>
    <div class="results">
      <section class="card" aria-labelledby="cmp-title">
        <h2 id="cmp-title" style="font-size:18px">Comparación con la misma demanda</h2>
        <div class="table-wrap" style="max-height:none;border:0">
          <table class="data-table" style="font-family:var(--font-body);font-size:14px">
            <thead><tr><th scope="col">Indicador</th><th scope="col">Continua (Q, ROP)</th><th scope="col">Periódica (T, S)</th></tr></thead>
            <tbody>
              <template x-for="(r, i) in v.cmp" :key="i">
                <tr><td x-text="r[0]" style="font-family:var(--font-body);padding:8px 10px"></td><td x-text="r[1]" class="num" style="padding:8px 10px"></td><td x-text="r[2]" class="num" style="padding:8px 10px"></td></tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="sr-only" aria-live="polite" x-text="live"></p>
      </section>
      ${chartCard({
        id: 'c1', title: 'Inventario a mano: continua vs. periódica', table: false,
        legendItems: [
          { label: 'Continua', color: '#1D4ED8' },
          { label: 'Periódica', color: '#C2410C', dash: 'short' },
          { label: 'Día de revisión', color: '#94A3B8', kind: 'tick' },
          { label: 'Faltante', color: '#B91C1C', kind: 'rect' },
        ],
        after: runbar('Ambas políticas avanzan juntas, día a día'),
      })}
      ${chartCard({
        id: 'c2', title: 'Tamaño de cada pedido',
        legendItems: [
          { label: 'Continua (lote fijo)', color: '#1D4ED8', kind: 'rect' },
          { label: 'Periódica (hasta S)', color: '#C2410C', kind: 'rect' },
        ],
      })}
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        '\\text{Continua: } ROP = \\bar d\\,L + z\\,\\sigma_d\\sqrt{L},\\ \\text{pedir } Q',
        '\\text{Periódica: } S = \\bar d\\,(T+L) + z\\,\\sigma_d\\sqrt{T+L}',
        '\\text{Pedido}_T = S - (\\text{a mano} + \\text{en tránsito})',
      ],
      tex: 'S = \\bar d\\,(T+L) + z\\,\\sigma_d\\sqrt{T+L}',
      notes: ['La periódica protege T + L días en lugar de L: necesita más inventario de seguridad, a cambio de revisar menos y consolidar pedidos.'],
    },
    uses: [
      'Continua: artículos caros o críticos (clase A) con control de inventario en tiempo real.',
      'Periódica: proveedores con día fijo de visita o ruta, y pedidos que agrupan muchos artículos.',
      'Elegir T: revisar más seguido reduce inventario pero aumenta pedidos y costo administrativo.',
      'Explicar por qué una tienda con reposición semanal mantiene más existencias que una con reposición diaria.',
    ],
    params: [
      ['d̄, σd, L, NS', 'Iguales que en el punto de reorden; se aplican a ambas políticas.', 'Ambos sistemas requieren más inventario; la periódica en mayor medida.'],
      ['Q', 'Lote fijo de la revisión continua.', 'Menos pedidos, más inventario de ciclo.'],
      ['T', 'Días entre revisiones de la política periódica.', 'Pedidos más grandes y espaciados; sube S y el inventario de seguridad (√(T + L)).'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewReviewSystems', title: 'Sistemas de revisión', template, data: defineView(def) };
