// Revisión continua (Q, ROP) frente a periódica (T, S) con la misma demanda. Módulo puro.
import { zFromService } from './rng.js';
import { demandSeries, simulateContinuous } from './reorderPoint.js';

export function periodicLevels({ dbar, sigma, L, sl, T }) {
  const z = zFromService(sl);
  const ss = z * sigma * Math.sqrt(T + L);
  return { z, ss, S: dbar * (T + L) + ss };
}

export function simulatePeriodic(p, demand) {
  const { S, ss, z } = periodicLevels(p);
  let h = Math.round(S - p.dbar * p.T / 2);
  const arr = {}, rows = [];
  let served = 0, total = 0, lost = 0, orders = 0, stockoutDays = 0, sumH = 0;
  for (let t = 0; t < demand.length; t++) {
    if (arr[t]) { h += arr[t]; delete arr[t]; }
    const d = demand[t], s = Math.min(h, d);
    h -= s; served += s; total += d; lost += d - s;
    const stockout = d > s;
    if (stockout) stockoutDays++;
    const onOrder = Object.values(arr).reduce((a, b) => a + b, 0);
    let ordered = 0;
    if ((t + 1) % p.T === 0) ordered = Math.max(0, Math.round(S - h - onOrder));
    if (ordered > 0) { arr[t + p.L + 1] = (arr[t + p.L + 1] || 0) + ordered; orders++; }
    sumH += h;
    rows.push({ t, demand: d, onHand: h, ordered, stockout, served, total, lost, orders, stockoutDays, avg: sumH / (t + 1) });
  }
  return { z, ss, S, rows, orders, lost, fillRate: total ? served / total : 1, avgInventory: rows.length ? sumH / rows.length : 0, stockoutDays };
}

export function compare(p, seed = 42) {
  const demand = demandSeries(p, seed);
  return { demand, continuous: simulateContinuous(p, demand), periodic: simulatePeriodic(p, demand) };
}
