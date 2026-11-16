// Estado ⇄ URL y escenarios en localStorage.

export const STORAGE_KEY = 'simecon:v1:scenarios';
export const DEFAULT_SEED = 42;

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [path = '', qs = ''] = raw.split('?');
  return { path: decodeURIComponent(path).replace(/\/+$/, ''), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function parseSeed(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 2147483647 ? n : DEFAULT_SEED;
}

/** Lee y valida los parámetros según el esquema; valores inválidos → defecto, numéricos → acotados al rango. */
export function readParams(schema, query = {}) {
  const out = {};
  for (const [id, s] of Object.entries(schema)) out[id] = coerce(s, query[id]);
  return out;
}

export function coerce(s, raw) {
  if (raw === undefined || raw === null || raw === '') return s.def;
  if (s.type === 'bool') return raw === true || raw === 'true' || raw === '1' || raw === 1;
  if (s.type === 'enum') {
    const hit = s.options.find((o) => String(o) === String(raw));
    return hit === undefined ? s.def : hit;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return s.def;
  return Math.min(s.max, Math.max(s.min, n));
}

export function serialize(schema, params, seed) {
  const q = new URLSearchParams();
  for (const id of Object.keys(schema)) {
    const v = params[id];
    if (v === null || v === undefined) continue;
    q.set(id, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  if (seed != null) q.set('seed', String(seed));
  return q.toString();
}

let urlTimer = 0, pendingUrl = null;
/** Actualiza la URL sin crear entradas de historial, tras 250 ms sin cambios. */
export function scheduleUrl(route, qs) {
  pendingUrl = '#/' + route + (qs ? '?' + qs : '');
  clearTimeout(urlTimer);
  urlTimer = setTimeout(flushUrl, 250);
}
export function flushUrl() {
  clearTimeout(urlTimer);
  if (pendingUrl && pendingUrl !== location.hash) history.replaceState(history.state, '', pendingUrl);
  pendingUrl = null;
}
export function cancelUrl() { clearTimeout(urlTimer); pendingUrl = null; }

/* ---------- Escenarios ---------- */
export function loadScenarios() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function persist(all) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function addScenario(route, entry) {
  const all = loadScenarios();
  all[route] = [...(all[route] || []), entry];
  return { all, ok: persist(all) };
}

export function removeScenario(route, index) {
  const all = loadScenarios();
  if (all[route]) { all[route].splice(index, 1); if (!all[route].length) delete all[route]; }
  return { all, ok: persist(all) };
}

/** Ruta y query activas (las escribe el router, las lee la vista al montarse). */
export const routeState = { path: '', query: {} };
