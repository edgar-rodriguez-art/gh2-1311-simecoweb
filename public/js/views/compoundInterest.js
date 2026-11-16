// #/interes-compuesto
import * as sim from '../sims/compoundInterest.js';
import { defineView, viewHead, slider, selectField, kpis, chartCard, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, tokens } from '../ui/charts.js';

const route = 'interes-compuesto';
const schema = {
  P: { def: 10000, min: 0, max: 100000, step: 500 },
  r: { def: 8, min: 0, max: 20, step: 0.25 },
  n: { def: 12, type: 'enum', options: [1, 2, 4, 12, 365] },
  t: { def: 10, min: 1, max: 40, step: 1 },
  A: { def: 0, min: 0, max: 2000, step: 50 },
  inf: { def: 4, min: 0, max: 10, step: 0.5 },
  rB: { def: 6, min: 0, max: 20, step: 0.25 },
};

// El módulo recibe fracciones; la URL y los controles usan porcentajes.
const toSim = (p) => ({ P: p.P, r: p.r / 100, n: p.n, t: p.t, A: p.A, inf: p.inf / 100, rB: p.rB / 100 });
const moneyAxis = (x) => (x >= 1e6 ? '$' + fx(x / 1e6, 1) + ' M' : x >= 1e3 ? '$' + fx(x / 1e3, 0) + ' k' : '$' + fx(x, 0));

const def = {
  route, schema,
  compute(p) {
    const q = toSim(p);
    return { s: sim.summary(q), series: sim.series(q) };
  },
  present({ s, series }, p) {
    const step = Math.max(1, Math.ceil(p.t / 12));
    const decision = 'Con estos supuestos, la alternativa ' + s.better + ' entrega $' + fx(Math.abs(s.diff), 2) + ' más al final de ' + p.t + ' años. ' +
      (s.inflationWarning
        ? 'Cuidado: la inflación iguala o supera la tasa efectiva, así que el capital pierde poder de compra.'
        : 'Descontada la inflación, el poder de compra crece ' + fx(s.realGrowth * 100, 1) + ' % sobre lo aportado.');
    return {
      warn: s.inflationWarning,
      k: {
        fv: '$' + fx(s.fv, 2), fvNote: 'Aportado $' + fx(s.contributed, 0),
        int: '$' + fx(s.interest, 2), intNote: fx(s.contributed ? s.interest / s.contributed * 100 : 0, 1) + ' % sobre lo aportado',
        ear: fx(s.ear * 100, 2) + ' %', earNote: 'Nominal ' + fx(p.r, 2) + ' %',
        dbl: Number.isFinite(s.doubling) ? fx(s.doubling, 1) : '∞', dblNote: 'Regla del 72: ' + (p.r > 0 ? fx(72 / p.r, 1) : '∞'),
        real: '$' + fx(s.real, 2), realNote: 'Con inflación de ' + fx(p.inf, 1) + ' %',
        fvB: '$' + fx(s.fvB, 2), diff: (s.diff >= 0 ? 'A supera a B por $' : 'B supera a A por $') + fx(Math.abs(s.diff), 0),
        decision,
      },
      alt: { c1: 'Saldo a ' + p.t + ' años: compuesto $' + fx(s.fv, 2) + ', alternativa B $' + fx(s.fvB, 2) + ', valor real $' + fx(s.real, 2) + '.' },
      tables: {
        c1: {
          cols: ['Año', 'Compuesto', 'Alt. B', 'Simple', 'Real', 'Aportado'],
          rows: series.filter((r) => r.y % step === 0 || r.y === p.t).map((r) => [r.y, '$' + fx(r.comp, 2), '$' + fx(r.altB, 2), '$' + fx(r.simple, 2), '$' + fx(r.real, 2), '$' + fx(r.contrib, 2)]),
        },
      },
    };
  },
  charts({ series }, p) {
    const t = tokens();
    const pts = (k) => series.map((r) => ({ x: r.y, y: r[k] }));
    const yMax = Math.max(...series.map((r) => Math.max(r.comp, r.altB, r.simple))) * 1.08 || 1;
    return {
      c1: {
        datasets: [
          line('Total aportado', pts('contrib'), { color: t.neutral, width: 2 }),
          line('Interés simple', pts('simple'), { color: t.s3, dash: 'dot', width: 2.5 }),
          line('Valor real', pts('real'), { color: t.s4, dash: 'dashdot', width: 2.5 }),
          line('Alternativa B', pts('altB'), { color: t.s2, dash: 'dash', width: 3 }),
          line('Compuesto (A)', pts('comp'), { color: t.s1, width: 3 }),
        ],
        x: { min: 0, max: p.t, title: 'Años', tipDigits: 0 },
        y: { min: 0, max: yMax, title: 'Saldo ($)', format: moneyAxis },
      },
    };
  },
  live: (v) => `Valor futuro ${v.k.fv}. Tasa efectiva ${v.k.ear}. Valor real ${v.k.real}. ${v.k.decision}`,
};

function template() {
  return `
<div class="view" x-data="viewCompoundInterest">
  ${viewHead({
    cat: 'Finanzas', module: 'js/sims/compoundInterest.js', title: 'Interés compuesto y decisiones financieras',
    desc: 'Proyecta cómo crece un capital cuando los intereses generan nuevos intereses. Compara frecuencias de capitalización, aportes periódicos, el efecto de la inflación y dos alternativas de tasa para tomar una decisión de inversión o de financiamiento.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${slider({ id: 'P', label: 'Capital inicial', sym: 'P', unit: '$', min: 0, max: 100000, step: 500 })}
      ${slider({ id: 'r', label: 'Tasa nominal anual', sym: 'r', unit: '%', min: 0, max: 20, step: 0.25, digits: 2 })}
      ${selectField({ id: 'n', label: 'Capitalización', sym: 'n', options: [[1, 'Anual (1)'], [2, 'Semestral (2)'], [4, 'Trimestral (4)'], [12, 'Mensual (12)'], [365, 'Diaria (365)']] })}
      ${slider({ id: 't', label: 'Plazo', sym: 't', unit: 'años', min: 1, max: 40, step: 1 })}
      ${slider({ id: 'A', label: 'Aporte por período', sym: 'A', unit: '$', min: 0, max: 2000, step: 50 })}
      ${slider({ id: 'inf', label: 'Inflación anual', sym: 'π', unit: '%', min: 0, max: 10, step: 0.5, digits: 1 })}
      ${slider({ id: 'rB', label: 'Tasa de la alternativa B', sym: 'r_B', unit: '%', min: 0, max: 20, step: 0.25, digits: 2 })}
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${kpis([
        ['Valor futuro (A)', 'v.k.fv', 'v.k.fvNote'],
        ['Intereses ganados', 'v.k.int', 'v.k.intNote'],
        ['Tasa efectiva anual', 'v.k.ear', 'v.k.earNote'],
        ['Años para duplicar', 'v.k.dbl', 'v.k.dblNote'],
        ['Valor real (poder de compra)', 'v.k.real', 'v.k.realNote'],
        ['Alternativa B', 'v.k.fvB', 'v.k.diff'],
      ])}
      ${chartCard({
        id: 'c1', title: 'Crecimiento del capital por año',
        legendItems: [
          { label: 'Compuesto (A)', color: '#1D4ED8' },
          { label: 'Alternativa B', color: '#C2410C', dash: 'short' },
          { label: 'Interés simple', color: '#0F766E', dash: 'dot', width: 2.5 },
          { label: 'Valor real', color: '#6D28D9', dash: 'dashdot', width: 2.5 },
          { label: 'Total aportado', color: '#64748B', width: 2 },
        ],
      })}
      <section class="notice" :class="{ warn: v.warn }" aria-labelledby="dec-title">
        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="10" fill="none" stroke="#1D4ED8" stroke-width="2"></circle><path d="M12 7 V13 M12 16.5 V17" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round"></path></svg>
        <div style="display:flex;flex-direction:column;gap:4px">
          <strong id="dec-title">Lectura para decidir</strong>
          <p x-text="v.k.decision"></p>
        </div>
      </section>
    </div>
  </div></div>
  ${explain({
    model: {
      formulas: [
        'VF = P\\left(1+\\tfrac{r}{n}\\right)^{nt} + A\\,\\frac{(1+r/n)^{nt}-1}{r/n}',
        'TEA = \\left(1+\\tfrac{r}{n}\\right)^{n}-1',
        '\\text{Valor real} = \\frac{VF}{(1+\\pi)^{t}}',
      ],
      tex: 'VF = P\\left(1+\\tfrac{r}{n}\\right)^{nt} + A\\,\\frac{(1+r/n)^{nt}-1}{r/n}',
      notes: ['Los aportes se depositan al final de cada período (anualidad vencida) con la misma frecuencia n.'],
    },
    uses: [
      'Comparar ofertas de inversión o crédito con distinta frecuencia usando la tasa efectiva.',
      'Planear fondos de reposición de maquinaria, retiro o reservas con aportes periódicos.',
      'Separar crecimiento nominal de crecimiento real cuando hay inflación.',
      'Mostrar el costo de oportunidad de esperar: unos puntos de tasa pesan mucho a largo plazo.',
    ],
    params: [
      ['P', 'Monto invertido hoy.', 'El valor futuro crece en proporción directa.'],
      ['r', 'Tasa nominal anual pactada.', 'Crecimiento exponencial: el tiempo para duplicar ≈ 72 / r.'],
      ['n', 'Veces al año que se capitaliza.', 'Sube la tasa efectiva, con rendimientos decrecientes (límite: capitalización continua).'],
      ['t', 'Años de la inversión.', 'La brecha entre interés simple y compuesto se abre cada vez más.'],
      ['A', 'Depósito al final de cada período.', 'Aumenta lo aportado y los intereses sobre esos aportes.'],
      ['π', 'Inflación anual esperada.', 'Reduce el poder de compra del valor futuro.'],
      ['r_B', 'Tasa de la alternativa con la que se compara.', 'Si supera a r, la alternativa B pasa a ser la mejor opción.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewCompoundInterest', title: 'Interés compuesto', template, data: defineView(def) };
