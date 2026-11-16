// Punto de reorden con demanda normal y ventas perdidas. Módulo puro.
import { mulberry32, normal, zFromService } from './rng.js';

export function demandSeries({ dbar, sigma, days }, seed) {
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < days; i++) out.push(Math.max(0, Math.round(normal(rng, dbar, sigma))));
  return out;
}

export function levels({ dbar, sigma, L, sl }) {
  const z = zFromService(sl);
  const ss = z * sigma * Math.sqrt(L);
  return { z, ss, rop: dbar * L + ss };
}

/** Política (Q, ROP) sobre una serie de demanda dada. */
export function simulateContinuous(p, demand) {
  const { rop, ss, z } = levels(p);
  let onHand = Math.round(rop + p.Q / 2);
  const arr = {}, rows = [];
  let lost = 0, served = 0, total = 0, orders = 0, cycles = 0, bad = 0, so = false, sumH = 0, stockoutDays = 0;
  for (let t = 0; t < demand.length; t++) {
    if (arr[t]) { onHand += arr[t]; delete arr[t]; cycles++; if (so) bad++; so = false; }
    const d = demand[t], s = Math.min(onHand, d);
    onHand -= s; served += s; total += d; lost += d - s;
    const stockout = d > s;
    if (stockout) { so = true; stockoutDays++; }
    const onOrder = Object.values(arr).reduce((a, b) => a + b, 0);
    let ordered = 0;
    if (onHand + onOrder <= rop) { arr[t + p.L + 1] = (arr[t + p.L + 1] || 0) + p.Q; ordered = p.Q; orders++; }
    sumH += onHand;
    rows.push({ t, demand: d, onHand, ordered, stockout, served, total, lost, orders, cycles, bad, stockoutDays, avg: sumH / (t + 1) });
  }
  return {
    z, ss, rop, rows, orders, lost,
    fillRate: total ? served / total : 1,
    cycleService: cycles ? 1 - bad / cycles : 1,
    cycles,
    avgInventory: rows.length ? sumH / rows.length : 0,
    stockoutDays,
  };
}

export function simulate(p, seed = 42) {
  return simulateContinuous(p, demandSeries(p, seed));
}
