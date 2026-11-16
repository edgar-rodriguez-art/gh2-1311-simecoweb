// Interés compuesto, aportes periódicos, inflación y comparación de alternativas. Módulo puro.
// r, rB e inf se reciben como fracciones (0.08 = 8 %).

export function futureValue({ P = 0, r = 0, n = 12, t = 0, A = 0 }) {
  const i = r / n, N = Math.round(n * t), g = (1 + i) ** N;
  return P * g + (i === 0 ? A * N : A * (g - 1) / i);
}

export function effectiveAnnualRate(r, n) { return (1 + r / n) ** n - 1; }

export function rule72(r) { return r > 0 ? 72 / (r * 100) : Infinity; }

export function doublingYears(r, n) { return r > 0 ? Math.log(2) / (n * Math.log(1 + r / n)) : Infinity; }

export function realValue(nominal, inf, t) { return nominal / (1 + inf) ** t; }

export function continuous(P, r, t) { return P * Math.exp(r * t); }

export function simpleValue({ P = 0, r = 0, n = 12, t = 0, A = 0 }) { return P * (1 + r * t) + A * n * t; }

export function series(p) {
  const out = [];
  for (let y = 0; y <= p.t; y++) {
    const comp = futureValue({ ...p, t: y });
    out.push({
      y,
      comp,
      altB: futureValue({ ...p, r: p.rB ?? 0, t: y }),
      simple: simpleValue({ ...p, t: y }),
      contrib: p.P + p.A * p.n * y,
      real: realValue(comp, p.inf ?? 0, y),
    });
  }
  return out;
}

export function summary(p) {
  const fv = futureValue(p);
  const fvB = futureValue({ ...p, r: p.rB ?? 0 });
  const contributed = p.P + p.A * p.n * p.t;
  const interest = fv - contributed;
  const ear = effectiveAnnualRate(p.r, p.n);
  const real = realValue(fv, p.inf ?? 0, p.t);
  const diff = fv - fvB;
  return {
    fv, fvB, contributed, interest, ear, real, diff,
    better: diff >= 0 ? 'A' : 'B',
    doubling: doublingYears(p.r, p.n),
    rule72: rule72(p.r),
    simple: simpleValue(p),
    inflationWarning: (p.inf ?? 0) >= ear,
    realGrowth: contributed ? real / contributed - 1 : 0,
  };
}
