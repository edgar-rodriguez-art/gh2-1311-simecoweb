// Efecto látigo: cadena de 4 eslabones con pronóstico de media móvil y política order-up-to. Módulo puro.
import { mulberry32, normal, sampleVariance } from './rng.js';

export const WARMUP = 10;

export function stageBound(L, p) { return 1 + 2 * L / p + 2 * L * L / (p * p); }

export function simulate({ mu, sigma, L, p, periods, share = false }, seed = 42) {
  const N = periods + WARMUP;
  const rng = mulberry32(seed), cust = [];
  for (let i = 0; i < N; i++) cust.push(Math.max(0, normal(rng, mu, sigma)));
  const orders = [];
  let inc = cust;
  for (let k = 0; k < 4; k++) {
    const sig = share ? cust : inc, q = [];
    let prev = mu * (L + 1);
    for (let t = 0; t < N; t++) {
      const w = sig.slice(Math.max(0, t - p + 1), t + 1);
      const S = w.reduce((a, b) => a + b, 0) / w.length * (L + 1);
      q.push(Math.max(0, inc[t] + S - prev));
      prev = S;
    }
    orders.push(q);
    inc = q;
  }
  return { customerAll: cust, ordersAll: orders, ...measure({ cust, orders, L, p }, periods) };
}

/** Mide sobre las primeras `n` semanas después del calentamiento. */
export function measure({ cust, orders, L, p }, n) {
  const customer = cust.slice(WARMUP, WARMUP + n);
  const O = orders.map((q) => q.slice(WARMUP, WARMUP + n));
  const vd = sampleVariance(customer) || 1;
  const ratios = O.map((q) => sampleVariance(q) / vd);
  const sb = stageBound(L, p);
  return {
    customer, orders: O, ratios,
    stageBound: sb,
    cumulativeBound: [0, 1, 2, 3].map((k) => sb ** (k + 1)),
    additiveBound: [0, 1, 2, 3].map((k) => 1 + (k + 1) * (sb - 1)),
  };
}
