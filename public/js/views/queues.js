// #/colas
import * as sim from '../sims/queues.js';
import { defineView, viewHead, slider, kpis, chartCard, runbar, explain, scenariosBlock, fx } from '../ui/components.js';
import { line, marks, tokens } from '../ui/charts.js';
import { prefersReducedMotion } from '../ui/runner.js';

const route = 'colas';
const STATIONS = ['Recepción', 'Proceso', 'Empaque'];
const MAX_SHOWN = 14;
const schema = {
  lambda: { def: 4, min: 0.5, max: 20, step: 0.5 },
  mu: { def: 5, min: 1, max: 20, step: 0.5 },
  c: { def: 1, min: 1, max: 5, step: 1 },
  hours: { def: 8, min: 1, max: 24, step: 1 },
  m1: { def: 6, min: 1, max: 20, step: 0.5 },
  m2: { def: 4.5, min: 1, max: 20, step: 0.5 },
  m3: { def: 5, min: 1, max: 20, step: 0.5 },
};

/* ---------- Fila animada (SVG + rAF) ---------- */
const NS = 'http://www.w3.org/2000/svg';
const qState = new WeakMap();
const slotX = (i) => 400 - i * 27;

function syncQueue(view, n) {
  const g = view.$refs.queue;
  if (!g) return;
  let s = qState.get(view);
  if (!s || s.g !== g) { s = { g, els: [], raf: 0 }; qState.set(view, s); }
  const target = Math.min(n, MAX_SHOWN);
  const leaving = [];
  while (s.els.length > target) leaving.push(s.els.shift());
  while (s.els.length < target) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', 10); c.setAttribute('cy', 24); c.setAttribute('fill', '#FDBA74'); c.setAttribute('stroke', '#C2410C'); c.setAttribute('stroke-width', 2);
    c._x = 10; c._o = 0;
    g.appendChild(c);
    s.els.push(c);
  }
  const anims = s.els.map((el, i) => ({ el, x0: el._x, x1: slotX(i), o0: el._o, o1: 1 }))
    .concat(leaving.map((el) => ({ el, x0: el._x, x1: 440, o0: 1, o1: 0, remove: true })));
  cancelAnimationFrame(s.raf);
  const finish = () => anims.forEach((a) => { a.el._x = a.x1; a.el._o = a.o1; a.el.setAttribute('cx', a.x1); a.el.setAttribute('opacity', a.o1); if (a.remove) a.el.remove(); });
  if (prefersReducedMotion()) { finish(); return; }
  const start = performance.now(), dur = 180;
  const frame = (now) => {
    const u = Math.min(1, (now - start) / dur);
    for (const a of anims) {
      a.el._x = a.x0 + (a.x1 - a.x0) * u; a.el._o = a.o0 + (a.o1 - a.o0) * u;
      a.el.setAttribute('cx', a.el._x.toFixed(1)); a.el.setAttribute('opacity', a.el._o.toFixed(2));
    }
    if (u < 1) s.raf = requestAnimationFrame(frame); else finish();
  };
  s.raf = requestAnimationFrame(frame);
}

const def = {
  route, schema, dynamic: true, unit: 'paso', ms: 60,
  compute(p, seed) {
    return {
      th: sim.mmc(p.lambda, p.mu, p.c),
      run: sim.simulate(p, seed),
      bn: sim.bottleneck(p.lambda, [p.m1, p.m2, p.m3]),
      curve: sim.lCurve(p.mu, p.c),
    };
  },
  total: (res) => res.run.steps,
  present({ th, run, bn }, p, k, view) {
    const kk = Math.max(1, k);
    const now = run.timeline[Math.min(kk, run.steps)];
    const st = sim.statsAt(run.customers, now.x);
    const m = Math.round(now.x * 60);
    const rows = [0.5, 0.7, 0.8, 0.9, 0.95].map((r) => { const q = sim.mmc(r * p.c * p.mu, p.mu, p.c); return [fx(r * 100, 0) + '%', fx(q.L, 2), fx(q.Lq, 2), fx(q.W * 60, 1)]; });
    const over = bn.growth > 0;
    view.$nextTick(() => syncQueue(view, now.queue));
    return {
      unstable: !th.stable,
      clock: 'hora ' + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'),
      q: {
        more: now.queue > MAX_SHOWN, extra: now.queue - MAX_SHOWN,
        servers: Array.from({ length: p.c }, (_, i) => { const b = now.busy.includes(i); return { i, label: 'Servidor ' + (i + 1) + (b ? ' · ocupado' : ' · libre'), fill: b ? '#1D4ED8' : '#FFFFFF', border: b ? '#1D4ED8' : '#CBD5E1' }; }),
        label: now.queue + ' en espera y ' + now.busy.length + ' de ' + p.c + ' servidores ocupados',
      },
      st: STATIONS.map((nm, i) => ({ name: nm, cap: fx(bn.caps[i], 1), u: fx(bn.utilization[i] * 100, 0) + ' %', w: Math.min(100, bn.utilization[i] * 100).toFixed(0) + '%', isB: i === bn.index })),
      bnColor: over ? '#B91C1C' : '#166534',
      bnSummary: 'Throughput ' + fx(bn.throughput, 1) + ' u/h · cuello: ' + STATIONS[bn.index] + (over ? ' · la fila crece ' + fx(bn.growth, 1) + ' u/h' : ''),
      k: {
        rho: fx(th.rho * 100, 1) + ' %',
        L: th.stable ? fx(th.L, 2) : '∞', Lq: th.stable ? 'Lq = ' + fx(th.Lq, 2) + ' en fila' : 'Inestable',
        W: th.stable ? fx(th.W * 60, 1) + ' min' : '∞', Wq: th.stable ? 'Wq = ' + fx(th.Wq * 60, 1) + ' min' : 'Inestable',
        Pw: th.stable ? fx(th.Pw * 100, 1) + ' %' : '100 %',
        simWq: fx(st.avgWq * 60, 1) + ' min', simN: st.served + ' clientes atendidos',
      },
      alt: {
        c1: 'Cola simulada a lo largo de ' + p.hours + ' horas; máximo ' + Math.max(...run.timeline.map((x) => x.queue)) + ' clientes esperando.' + (th.stable ? ' Lq teórica ' + fx(th.Lq, 2) + '.' : ''),
        c2: 'Curva de L contra la utilización: crece lentamente hasta 70 % y se dispara cerca de 100 %. Punto actual ρ = ' + fx(th.rho * 100, 0) + ' %.',
      },
      tables: {
        c1: { cols: ['Hora', 'En espera', 'En el sistema'], rows: run.timeline.slice(0, kk + 1).filter((_, i) => i % 5 === 0).map((x) => [fx(x.x, 2), x.queue, x.system]) },
        c2: { cols: ['ρ', 'L', 'Lq', 'W (min)'], rows },
      },
    };
  },
  charts({ th, run, curve }, p, k) {
    const t = tokens();
    const kk = Math.max(1, k);
    const shown = run.timeline.slice(0, kk + 1);
    const qMax = Math.max(4, ...run.timeline.map((x) => x.queue), th.stable ? th.Lq * 2 : 0) * 1.1;
    const Lmax = Math.max(...curve.map((c) => c.L)) * 1.05;
    const rhoC = Math.min(th.rho, 0.95);
    const Lc = sim.mmc(rhoC * p.c * p.mu, p.mu, p.c).L;
    const ds1 = [line('Simulada', shown.map((x) => ({ x: x.x, y: x.queue })), { color: t.s1, width: 2.5, stepped: 'after' })];
    if (th.stable) ds1.push(line('Lq teórica', [{ x: 0, y: th.Lq }, { x: p.hours, y: th.Lq }], { color: t.s2, dash: 'dash', width: 2.5 }));
    return {
      c1: { datasets: ds1, x: { min: 0, max: p.hours, title: 'Hora', tipDigits: 2 }, y: { min: 0, max: qMax, title: 'Clientes en espera', tipDigits: 0 } },
      c2: {
        datasets: [
          marks('Punto actual', [{ x: rhoC, y: Math.min(Lc, Lmax) }], { color: t.s2, radius: 7, pointBorder: '#FFFFFF', pointBorderWidth: 2 }),
          line('L(ρ)', curve.map((c) => ({ x: c.rho, y: c.L })), { color: t.s1, width: 3 }),
        ],
        x: { min: 0, max: 1, title: 'Utilización ρ', format: (v) => fx(v * 100, 0) + '%' },
        y: { min: 0, max: Lmax, title: 'Clientes en el sistema L' },
      },
    };
  },
  unmounted(view) { const s = qState.get(view); if (s) cancelAnimationFrame(s.raf); },
  live: (v) => `Utilización ${v.k.rho}. L ${v.k.L}, W ${v.k.W}. Espera simulada ${v.k.simWq}. ${v.bnSummary}.`,
};

function template() {
  return `
<div class="view" x-data="viewQueues">
  ${viewHead({
    cat: 'Servicios', module: 'js/sims/queues.js', title: 'Teoría de colas y cuellos de botella', dynamic: true,
    desc: 'Clientes llegan al azar a un servicio con uno o varios servidores. Compara las fórmulas del modelo M/M/1 y M/M/c con una simulación por eventos y observa cómo la fila explota cuando la utilización se acerca a 100 %. Abajo, una línea de tres estaciones muestra qué etapa limita el flujo.',
  })}
  <div class="sim-layout"><div class="sim-grid">
    <section class="card params" aria-labelledby="params-title">
      <h2 id="params-title">Parámetros</h2>
      ${slider({ id: 'lambda', label: 'Tasa de llegada', sym: 'λ', unit: 'clientes/h', min: 0.5, max: 20, step: 0.5, digits: 1 })}
      ${slider({ id: 'mu', label: 'Tasa de servicio por servidor', sym: 'μ', unit: 'clientes/h', min: 1, max: 20, step: 0.5, digits: 1 })}
      ${slider({ id: 'c', label: 'Servidores', sym: 'c', unit: '', min: 1, max: 5, step: 1 })}
      ${slider({ id: 'hours', label: 'Horas simuladas', sym: 'H', unit: 'h', min: 1, max: 24, step: 1, structural: true })}
      <template x-if="v.unstable">
        <div role="alert" class="alert-danger"><strong>Sistema inestable:</strong> λ ≥ c·μ. La fila crece sin límite; las fórmulas no aplican y solo se muestra la simulación.</div>
      </template>
      ${scenariosBlock()}
    </section>
    <div class="results">
      ${kpis([
        ['Utilización ρ', 'v.k.rho', "'λ / (c·μ)'"],
        ['En el sistema L', 'v.k.L', 'v.k.Lq'],
        ['Tiempo en el sistema W', 'v.k.W', 'v.k.Wq'],
        ['Prob. de esperar', 'v.k.Pw'],
        ['Espera simulada', 'v.k.simWq', 'v.k.simN'],
      ])}
      <section class="card" aria-labelledby="anim-title">
        <div class="card-head">
          <h2 id="anim-title" x-text="'Fila en vivo · ' + v.clock"></h2>
          <span style="font-size:13px;color:var(--ink-2)" x-text="v.q.label"></span>
        </div>
        <div role="img" :aria-label="v.q.label" style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:16px;background:var(--surface-2);border-radius:12px;min-height:120px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--muted)"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="M6 30 V8 H30 V30" fill="none" stroke="#475569" stroke-width="2"></path><path d="M14 18 H24 M20 14 L24 18 L20 22" fill="none" stroke="#475569" stroke-width="2"></path></svg>Llegadas</div>
          <div style="flex:1 1 240px;position:relative;padding:6px;border:2px dashed #CBD5E1;border-radius:10px;min-width:0">
            <svg viewBox="0 0 420 48" style="width:100%;height:auto;display:block" aria-hidden="true">
              <text x="6" y="29" font-family="JetBrains Mono, monospace" font-size="13" font-weight="600" fill="#9A3412" x-show="v.q.more" x-text="'+' + v.q.extra"></text>
              <g x-ref="queue"></g>
            </svg>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <template x-for="s in v.q.servers" :key="s.i">
              <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:#FFFFFF" :style="'border:2px solid ' + s.border">
                <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10" :fill="s.fill" stroke="#1D4ED8" stroke-width="2"></circle></svg>
                <span style="font-size:13px;font-weight:600" x-text="s.label"></span>
              </div>
            </template>
          </div>
        </div>
        ${runbar('3 minutos por paso')}
      </section>
      ${chartCard({
        id: 'c1', title: 'Longitud de la cola en el tiempo',
        legendItems: [{ label: 'Simulada', color: '#1D4ED8' }, { label: 'Lq teórica', color: '#C2410C', dash: 'short' }],
      })}
      ${chartCard({
        id: 'c2', title: 'Clientes en el sistema según la utilización',
        legendItems: [{ label: 'L(ρ)', color: '#1D4ED8' }, { label: 'Punto actual', color: '#C2410C', kind: 'dot' }],
      })}
    </div>
  </div></div>
  <section class="card" aria-labelledby="bn-title" style="gap:16px">
    <div class="card-head">
      <h2 id="bn-title" style="font-size:20px">Cuello de botella en una línea de 3 estaciones</h2>
      <span style="font-size:14px;font-weight:600" :style="'color:' + v.bnColor" x-text="v.bnSummary"></span>
    </div>
    <div class="stations">
      <div class="sliders">
        ${slider({ id: 'm1', label: 'Recepción', sym: 'μ₁', unit: 'u/h', min: 1, max: 20, step: 0.5, digits: 1 })}
        ${slider({ id: 'm2', label: 'Proceso', sym: 'μ₂', unit: 'u/h', min: 1, max: 20, step: 0.5, digits: 1 })}
        ${slider({ id: 'm3', label: 'Empaque', sym: 'μ₃', unit: 'u/h', min: 1, max: 20, step: 0.5, digits: 1 })}
      </div>
      <div class="cards">
        <template x-for="s in v.st" :key="s.name">
          <div class="station" :class="{ bottleneck: s.isB }">
            <div class="head"><strong style="font-size:14px" x-text="s.name"></strong><span class="badge danger" x-show="s.isB">CUELLO</span></div>
            <span class="cap" x-text="'Capacidad ' + s.cap + ' u/h'"></span>
            <div class="bar" aria-hidden="true"><div :style="'width:' + s.w"></div></div>
            <span class="u" x-text="'Utilización ' + s.u"></span>
          </div>
        </template>
      </div>
    </div>
  </section>
  ${explain({
    model: {
      formulas: [
        '\\rho = \\frac{\\lambda}{c\\mu}',
        '\\text{M/M/1: } L = \\frac{\\rho}{1-\\rho}, \\quad W = \\frac{1}{\\mu-\\lambda}',
        'L_q = \\frac{\\rho^2}{1-\\rho}, \\quad W_q = \\frac{\\rho}{\\mu-\\lambda}',
        '\\text{Ley de Little: } L = \\lambda W, \\quad L_q = \\lambda W_q',
        '\\text{Línea: } X = \\min(\\lambda, \\mu_1, \\mu_2, \\mu_3)',
      ],
      tex: '\\rho = \\frac{\\lambda}{c\\mu}    L = \\frac{\\rho}{1-\\rho}    W = \\frac{1}{\\mu-\\lambda}    L = \\lambda W',
      notes: [
        'Para c &gt; 1 se usa la fórmula de Erlang C. Llegadas Poisson y tiempos de servicio exponenciales, simulados con semilla.',
        'En pocas horas y con el sistema vacío al inicio, la espera simulada suele ser menor que la de estado estable (Wq): la fila aún no alcanza su régimen. Es un buen punto de discusión en clase.',
      ],
    },
    uses: [
      'Dimensionar cajeros, ventanillas, agentes de call center o camas de hospital.',
      'Mostrar por qué operar al 95 % de utilización produce esperas enormes.',
      'Encontrar la estación que limita la producción y no invertir en las demás.',
      'Estimar tiempos de espera prometidos al cliente con la ley de Little.',
    ],
    params: [
      ['λ', 'Clientes que llegan por hora (en promedio).', 'Sube la utilización; cerca de c·μ la fila se dispara.'],
      ['μ', 'Clientes que atiende cada servidor por hora.', 'Baja la utilización, la fila y la espera.'],
      ['c', 'Servidores en paralelo con una sola fila.', 'Más capacidad: la probabilidad de esperar cae con rapidez.'],
      ['H', 'Horas que dura la simulación.', 'Más tiempo para acercarse al estado estable de las fórmulas.'],
      ['μ₁, μ₂, μ₃', 'Capacidad de cada estación de la línea.', 'Solo mejorar la estación más lenta aumenta el throughput.'],
    ],
  })}
</div>`;
}

export default { route, name: 'viewQueues', title: 'Colas y cuellos de botella', template, data: defineView(def) };
