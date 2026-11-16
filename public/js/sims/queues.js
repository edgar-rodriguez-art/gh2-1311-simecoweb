// Teoría de colas M/M/1 y M/M/c, simulación por eventos y cuello de botella. Módulo puro.
import { mulberry32, exponential } from './rng.js';

export function mm1(lambda, mu) {
  const rho = lambda / mu;
  if (rho >= 1) return { rho, stable: false, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, Pw: 1 };
  return { rho, stable: true, L: rho / (1 - rho), Lq: rho * rho / (1 - rho), W: 1 / (mu - lambda), Wq: rho / (mu - lambda), Pw: rho };
}

/** M/M/c con Erlang C. */
export function mmc(lambda, mu, c = 1) {
  const a = lambda / mu, rho = a / c;
  if (rho >= 1) return { rho, stable: false, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity, Pw: 1 };
  let sum = 0, term = 1;
  for (let k = 0; k < c; k++) { if (k > 0) term *= a / k; sum += term; }
  const last = term * a / c;
  const P0 = 1 / (sum + last / (1 - rho));
  const Pw = last / (1 - rho) * P0;
  const Lq = Pw * rho / (1 - rho), Wq = Lq / lambda, W = Wq + 1 / mu;
  return { rho, stable: true, P0, Pw, Lq, Wq, W, L: lambda * W };
}

export const DT = 0.05;

export function simulate({ lambda, mu, c = 1, hours = 8 }, seed = 42) {
  const rng = mulberry32(seed), srv = Array(c).fill(0), customers = [];
  let t = 0;
  for (;;) {
    t += exponential(rng, lambda);
    if (t > hours) break;
    const i = srv.indexOf(Math.min(...srv));
    const s = Math.max(t, srv[i]);
    const e = s + exponential(rng, mu);
    srv[i] = e;
    customers.push({ a: t, s, e, i });
  }
  const steps = Math.round(hours / DT), timeline = [];
  for (let j = 0; j <= steps; j++) {
    const x = j * DT;
    const busy = [...new Set(customers.filter((d) => d.s <= x && d.e > x).map((d) => d.i))];
    const queue = customers.filter((d) => d.a <= x && d.s > x).length;
    timeline.push({ x, queue, busy, system: queue + busy.length });
  }
  return { customers, timeline, steps, ...statsAt(customers, hours) };
}

/** Espera promedio simulada de los clientes que ya iniciaron servicio antes de `x`. */
export function statsAt(customers, x) {
  const done = customers.filter((d) => d.s <= x);
  return { served: done.length, avgWq: done.length ? done.reduce((a, d) => a + (d.s - d.a), 0) / done.length : 0 };
}

export function bottleneck(lambda, stations) {
  const caps = stations.map((s) => (typeof s === 'number' ? s : s.c * s.mu));
  const minCap = Math.min(...caps), index = caps.indexOf(minCap), X = Math.min(lambda, minCap);
  return { caps, index, throughput: X, utilization: caps.map((c) => X / c), growth: lambda > minCap ? lambda - minCap : 0 };
}

export function lCurve(mu, c = 1, from = 0.05, to = 0.95, stepSize = 0.01) {
  const out = [];
  for (let r = from; r <= to + 1e-3; r += stepSize) out.push({ rho: r, L: mmc(r * c * mu, mu, c).L });
  return out;
}
