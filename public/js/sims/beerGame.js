// Beer Game simplificado: 4 roles, retraso de pedido 1 semana, de envío 2 semanas. Módulo puro.
import { mulberry32, poisson, sampleVariance } from './rng.js';

export const ROLES = ['Minorista', 'Mayorista', 'Distribuidor', 'Fábrica'];
export const S_STAR = 12;
export const HOLD_COST = 0.5;
export const BACKLOG_COST = 1;

export function demandSeries({ demandMode = 'poisson', lambda = 4, weeks = 36 }, seed = 42) {
  const rng = mulberry32(seed), out = [];
  for (let w = 0; w < weeks; w++) out.push(demandMode === 'escalon' ? (w + 1 >= 5 ? 8 : 4) : poisson(rng, lambda));
  return out;
}

export function init(params, seed = params.seed ?? 42) {
  const p = { demandMode: 'poisson', lambda: 4, alpha: 0.3, beta: 0.3, theta: 0.25, weeks: 36, ...params };
  const base = p.demandMode === 'escalon' ? 4 : p.lambda;
  return {
    p,
    week: 0,
    demand: demandSeries(p, seed),
    roles: [0, 1, 2, 3].map(() => ({ stock: S_STAR, backlog: 0, inv: S_STAR, ship: [base, base], orders: [base], expected: base, outstanding: base * 3 })),
    history: [],
  };
}

function clone(state) {
  return { ...state, roles: state.roles.map((s) => ({ ...s, ship: [...s.ship], orders: [...s.orders] })), history: state.history };
}

/** Fase previa a la decisión: recepción, pedidos entrantes, envíos y pronóstico. No muta `state`. */
export function prepare(state) {
  const p = state.p, w = state.week, next = clone(state), R = next.roles;
  for (const s of R) { const r = s.ship.shift(); s.stock += r; s.outstanding -= r; }
  const incoming = [state.demand[w], R[0].orders.shift(), R[1].orders.shift(), R[2].orders.shift()];
  const factoryOrder = R[3].orders.shift();
  const shipped = [];
  for (let k = 0; k < 4; k++) {
    const s = R[k], owed = incoming[k] + s.backlog, o = Math.min(s.stock, owed);
    s.stock -= o; s.backlog = owed - o; s.inv = s.stock - s.backlog; shipped.push(o);
    if (k > 0) R[k - 1].ship.push(o);
  }
  R[3].ship.push(factoryOrder);
  const suggestions = [];
  for (let k = 0; k < 4; k++) {
    const s = R[k];
    s.expected = p.theta * incoming[k] + (1 - p.theta) * s.expected;
    suggestions.push(Math.max(0, Math.round(s.expected + p.alpha * ((S_STAR - s.inv) + p.beta * (s.expected * 2 - s.outstanding)))));
  }
  return { next, incoming, shipped, suggestions };
}

/** Avanza una semana. `humanOrders` = { [rol]: pedido } reemplaza la regla en esos roles. */
export function step(state, humanOrders = {}) {
  if (state.week >= state.p.weeks) return state;
  const { next, incoming, shipped, suggestions } = prepare(state);
  const ord = suggestions.map((o, k) => (humanOrders[k] != null ? Math.max(0, Math.round(humanOrders[k])) : o));
  next.roles.forEach((s, k) => { s.orders.push(ord[k]); s.outstanding += ord[k]; });
  const inv = next.roles.map((s) => s.inv);
  next.history = [...state.history, {
    w: state.week + 1, d: state.demand[state.week], incoming, shipped, ord, inv,
    cost: inv.map((i) => Math.max(0, i) * HOLD_COST + Math.max(0, -i) * BACKLOG_COST),
    pipe: next.roles.map((s) => s.ship.join('+')),
  }];
  next.week = state.week + 1;
  return next;
}

/** Estado del rol `role` al inicio de la semana actual (para el panel «Tu turno»). */
export function pending(state, role) {
  if (state.week >= state.p.weeks || role < 0) return null;
  const { next, incoming, suggestions } = prepare(state);
  const s = next.roles[role];
  return { incoming: incoming[role], inv: s.inv, outstanding: s.outstanding, pipeline: s.ship.join(' + '), hint: suggestions[role] };
}

export function run(params, seed = params.seed ?? 42, humanByWeek = {}, role = -1) {
  let st = init(params, seed);
  while (st.week < st.p.weeks) {
    const h = role >= 0 && humanByWeek[st.week] != null ? { [role]: humanByWeek[st.week] } : {};
    st = step(st, h);
  }
  return st;
}

export function summarize(state) {
  const H = state.history;
  const vd = sampleVariance(H.map((r) => r.d)) || 1;
  const ratios = [0, 1, 2, 3].map((k) => sampleVariance(H.map((r) => r.ord[k])) / vd);
  const costByRole = [0, 1, 2, 3].map((k) => H.reduce((a, r) => a + r.cost[k], 0));
  return { ratios, costByRole, totalCost: costByRole.reduce((a, b) => a + b, 0) };
}
