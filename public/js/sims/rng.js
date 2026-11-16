// Generadores pseudoaleatorios reproducibles (sin Math.random).

/** mulberry32: PRNG de 32 bits. Devuelve una función que produce valores en [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal(m, s) por Box-Muller (usa dos sorteos por valor). */
export function normal(rng, m = 0, s = 1) {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Exponencial con tasa `rate`. */
export function exponential(rng, rate) {
  return -Math.log(1 - rng()) / rate;
}

/** Poisson(lambda) por el método de Knuth. */
export function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, q = 1;
  do { k++; q *= rng(); } while (q > L);
  return k - 1;
}

/** Tabla de z para los niveles de servicio usados en la app. */
export const Z_TABLE = { 0.8: 0.8416, 0.85: 1.0364, 0.9: 1.2816, 0.95: 1.6449, 0.975: 1.96, 0.99: 2.3263, 0.999: 3.0902 };

/** Inversa de la normal estándar (Acklam). Para niveles tabulados devuelve el valor de tabla. */
export function zFromService(p) {
  const key = Math.round(p * 1000) / 1000;
  if (Z_TABLE[key] != null) return Z_TABLE[key];
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Varianza muestral (n − 1). */
export function sampleVariance(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}
