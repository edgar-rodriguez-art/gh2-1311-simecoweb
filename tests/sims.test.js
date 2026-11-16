import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, zFromService } from '../public/js/sims/rng.js';
import * as sd from '../public/js/sims/supplyDemand.js';
import * as ci from '../public/js/sims/compoundInterest.js';
import * as eoq from '../public/js/sims/eoq.js';
import * as rop from '../public/js/sims/reorderPoint.js';
import * as rev from '../public/js/sims/reviewSystems.js';
import * as bw from '../public/js/sims/bullwhip.js';
import * as bg from '../public/js/sims/beerGame.js';
import * as q from '../public/js/sims/queues.js';

const near = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperado ${b}, obtenido ${a}`);

test('rng: mulberry32 y zFromService', () => {
  const r = mulberry32(42);
  near(r(), 0.6011037519, 1e-9);
  near(r(), 0.4482905590, 1e-9);
  near(zFromService(0.95), 1.6449, 1e-4);
  near(zFromService(0.99), 2.3263, 1e-4);
  near(zFromService(0.9), 1.2816, 1e-3);
  // misma semilla, misma secuencia
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('oferta y demanda: equilibrio, impuesto y precio máximo', () => {
  const e = sd.equilibrium({ a: 120, b: 2, c: 0, d: 2, t: 0 });
  near(e.P, 30); near(e.Q, 60); near(e.cs, 900); near(e.ps, 900);
  const tx = sd.equilibrium({ a: 120, b: 2, c: 0, d: 2, t: 4 });
  near(tx.P, 32); near(tx.Pp, 28); near(tx.Q, 56); near(tx.revenue, 224); near(tx.dwl, 8);
  const pc = sd.priceCeiling({ a: 120, b: 3, c: 0, d: 2, t: 0 }, 18);
  assert.ok(pc.binding); near(pc.Qd, 66); near(pc.Qs, 36); near(pc.shortage, 30);
  const def = sd.equilibrium({ a: 120, b: 3, c: 0, d: 2, t: 0 });
  near(def.P, 24); near(def.Q, 48);
});

test('telaraña: converge y diverge', () => {
  const cw = sd.cobweb({ a: 120, b: 3, c: 0, d: 2, t: 0 }, { P0: 10, periods: 30 });
  assert.equal(cw.regime, 'converge');
  assert.equal(cw.path.length, 31);
  near(cw.path[30].P, 24, 1e-3);
  assert.equal(sd.cobweb({ a: 120, b: 2, c: 0, d: 3, t: 0 }).regime, 'diverge');
  assert.equal(sd.cobweb({ a: 120, b: 2, c: 0, d: 2, t: 0 }).regime, 'cycle');
});

test('interés compuesto', () => {
  near(ci.futureValue({ P: 10000, r: 0.08, n: 12, t: 10 }), 22196.40);
  near(ci.futureValue({ P: 1000, r: 0.10, n: 1, t: 2 }), 1210);
  near(ci.futureValue({ P: 0, A: 100, r: 0.12, n: 12, t: 1 }), 1268.25);
  near(ci.effectiveAnnualRate(0.08, 12) * 100, 8.30);
  const s = ci.summary({ P: 10000, r: 0.08, n: 12, t: 10, A: 0, inf: 0.04, rB: 0.06 });
  near(s.real, 14995.09); near(s.fvB, 18193.97); assert.equal(s.better, 'A');
  const z = ci.summary({ P: 10000, r: 0, n: 12, t: 10, A: 100, inf: 0.04, rB: 0 });
  assert.ok(Number.isFinite(z.fv)); assert.equal(z.doubling, Infinity); near(z.fv, 10000 + 100 * 120);
});

test('EOQ', () => {
  const s = eoq.summary({ D: 1200, S: 50, H: 2 });
  near(s.Qs, 244.95); near(s.N, 4.90); near(s.T, 73.48); near(s.TCs, 489.90);
  const s2 = eoq.summary({ D: 1200, S: 50, H: 2, Q: 400 });
  near(s2.TC, 550); near(s2.penalty, 12.27);
});

test('punto de reorden: niveles y simulación con semilla 42', () => {
  const p = { dbar: 20, sigma: 5, L: 4, sl: 0.95, Q: 200, days: 120 };
  const l = rop.levels(p);
  near(l.ss, 16.45); near(l.rop, 96.45);
  const s = rop.simulate(p, 42);
  assert.equal(s.orders, 12); assert.equal(s.lost, 50); near(s.fillRate, 0.9789, 1e-4);
  near(s.cycleService, 0.545, 1e-3);
  assert.deepEqual(rop.simulate(p, 42).rows, s.rows, 'reproducible');
});

test('revisión continua vs periódica', () => {
  const c = rev.compare({ dbar: 20, sigma: 5, L: 4, sl: 0.95, Q: 200, days: 120, T: 7 }, 42);
  near(c.periodic.S, 247.28); near(c.periodic.ss, 27.28);
  assert.equal(c.periodic.orders, 17); assert.equal(c.continuous.orders, 12);
  assert.ok(c.periodic.ss > c.continuous.ss);
  assert.deepEqual(c.continuous.rows.map((r) => r.demand), c.periodic.rows.map((r) => r.demand), 'misma demanda');
});

test('efecto látigo', () => {
  const p = { mu: 100, sigma: 10, L: 2, p: 5, periods: 52 };
  const r = bw.simulate(p, 42);
  near(r.stageBound, 2.12);
  [3.35, 13.13, 47.54, 136.94].forEach((v, k) => near(r.ratios[k], v, 0.01, `eslabón ${k}`));
  for (let k = 1; k < 4; k++) assert.ok(r.ratios[k] > r.ratios[k - 1]);
  const sh = bw.simulate({ ...p, share: true }, 42);
  near(sh.ratios[3], 21.76); assert.ok(sh.ratios[3] < r.ratios[3]);
});

test('beer game', () => {
  const st = bg.run({}, 42);
  assert.equal(st.history.length, 36);
  const s = bg.summarize(st);
  [0.84, 1.51, 2.63, 4.29].forEach((v, k) => near(s.ratios[k], v, 0.01, `rol ${k}`));
  for (let k = 1; k < 4; k++) assert.ok(s.ratios[k] > s.ratios[k - 1]);
  near(s.totalCost, 961.5);
  near(bg.summarize(bg.run({ demandMode: 'escalon' }, 42)).totalCost, 2673.5);
  // el jugador que usa siempre la sugerencia reproduce la corrida automática
  let h = bg.init({}, 42);
  while (h.week < 36) { const pend = bg.pending(h, 1); h = bg.step(h, { 1: pend.hint }); }
  near(bg.summarize(h).totalCost, 961.5);
});

test('colas y cuello de botella', () => {
  const m = q.mm1(4, 5);
  near(m.rho, 0.8); near(m.L, 4); near(m.Lq, 3.2); near(m.W, 1); near(m.Wq, 0.8); near(m.L, 4 * m.W);
  const c1 = q.mmc(4, 5, 1); near(c1.L, 4); near(c1.Pw, 0.8);
  const c = q.mmc(8, 5, 2); near(c.Pw, 0.7111, 1e-4); near(c.Lq, 2.8444, 1e-4); near(c.L, 4.4444, 1e-4);
  assert.equal(q.mm1(5, 5).stable, false);
  assert.equal(q.mmc(10, 5, 2).stable, false);
  const b = q.bottleneck(5, [6, 4, 5]);
  assert.equal(b.index, 1); near(b.throughput, 4); near(b.growth, 1);
  const sim = q.simulate({ lambda: 4, mu: 5, c: 1, hours: 8 }, 42);
  near(sim.avgWq * 60, 13.3, 0.05);
  assert.equal(sim.timeline.length, 161);
});
