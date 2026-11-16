// Cantidad económica de pedido (EOQ). Módulo puro.

export function eoq({ D, S, H }) { return Math.sqrt(2 * D * S / H); }

export function totalCost({ D, S, H }, Q) { return D / Q * S + Q / 2 * H; }

export function summary(p, days = 360) {
  const Qs = eoq(p);
  const Q = p.Q ?? Math.round(Qs);
  const TCs = totalCost(p, Qs), TC = totalCost(p, Q);
  return {
    Qs, Q, N: p.D / Qs, T: Qs / p.D * days, TCs, TC,
    orderingCost: p.D / Qs * p.S, holdingCost: Qs / 2 * p.H,
    penalty: (TC / TCs - 1) * 100,
    ordersQ: p.D / Q,
  };
}

export function costCurve(p, qMin = 20, qMax = 2000, steps = 80) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const q = qMin + (qMax - qMin) * i / steps;
    out.push({ q, ordering: p.D / q * p.S, holding: q / 2 * p.H, total: totalCost(p, q) });
  }
  return out;
}

export function sawtooth(p, Q, horizonDays = 360) {
  const daily = p.D / horizonDays, cyc = Q / daily, out = [];
  for (let t = 0; t < horizonDays; t += cyc) {
    out.push({ x: t, y: Q });
    out.push({ x: Math.min(t + cyc, horizonDays), y: Math.max(0, Q - daily * Math.min(cyc, horizonDays - t)) });
  }
  return out;
}
