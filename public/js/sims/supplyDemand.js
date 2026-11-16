// Oferta y demanda lineales, impuesto, precio máximo y telaraña. Módulo puro.

const qd = (p, P) => Math.max(0, p.a - p.b * P);
const qs = (p, P, tax = p.t ?? 0) => Math.max(0, p.c + p.d * (P - tax));

export function demand(p, P) { return qd(p, P); }
export function supply(p, P, tax) { return qs(p, P, tax); }

export function equilibrium(p) {
  const { a, b, c, d } = p, t = p.t ?? 0;
  const P = (a - c + d * t) / (b + d);
  const Q = a - b * P;
  const Pp = P - t;
  const P0 = (a - c) / (b + d), Q0 = a - b * P0;
  const cs = 0.5 * Q * (a / b - P);
  const ps = 0.5 * Q * (Pp + c / d);
  const revenue = t * Q;
  const dwl = 0.5 * t * (Q0 - Q);
  return { P, Q, Pp, P0, Q0, cs, ps, revenue, dwl };
}

export function priceCeiling(p, pmax) {
  const { P } = equilibrium(p);
  const binding = pmax > 0 && pmax < P;
  const Qd = qd(p, pmax), Qs = qs(p, pmax);
  return { binding, Qd, Qs, shortage: binding ? Qd - Qs : 0 };
}

export function cobweb(p, { P0 = 10, periods = 30 } = {}) {
  const path = [{ k: 0, P: P0, Q: null }];
  let Pk = P0;
  for (let k = 1; k <= periods; k++) {
    const Qk = qs(p, Pk);
    Pk = Math.max(0, (p.a - Qk) / p.b);
    path.push({ k, P: Pk, Q: Qk });
  }
  const ratio = p.d / p.b;
  const regime = Math.abs(ratio - 1) < 1e-9 ? 'cycle' : ratio < 1 ? 'converge' : 'diverge';
  return { path, ratio, regime };
}

/** Puntos (Q, P) de las curvas para graficar; P en [0, pTop]. */
export function curves(p, steps = 40) {
  const t = p.t ?? 0;
  const pTop = Math.max(p.a / p.b, 10) * 1.05, qTop = p.a * 1.05;
  const mk = (fn) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) { const P = pTop * i / steps; const Q = fn(P); if (Q <= qTop) pts.push({ x: Q, y: P }); }
    return pts;
  };
  return {
    pTop, qTop,
    demand: mk((P) => qd(p, P)),
    supply: mk((P) => qs(p, P, t)),
    supplyNoTax: t > 0 ? mk((P) => qs(p, P, 0)) : [],
  };
}
