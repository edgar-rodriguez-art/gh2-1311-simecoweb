// Fábrica de gráficas Chart.js (build UMD, window.Chart) con los tokens de diseño.
// Las gráficas se crean una vez y luego solo se actualizan con chart.update('none').

const fmtNum = (v, d = 0) => Number(v).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

export const DASH = {
  solid: [],
  dash: [8, 5],
  dot: [2, 4],
  dashdot: [10, 4, 2, 4],
  short: [6, 4],
  fine: [3, 4],
};

let tokenCache = null;
export function tokens() {
  if (tokenCache) return tokenCache;
  const cs = getComputedStyle(document.documentElement);
  const g = (n, f) => cs.getPropertyValue(n).trim() || f;
  tokenCache = {
    s1: g('--series-1', '#1D4ED8'), s2: g('--series-2', '#C2410C'), s3: g('--series-3', '#0F766E'), s4: g('--series-4', '#6D28D9'),
    ref: g('--series-ref', '#0F172A'), neutral: g('--series-neutral', '#64748B'), danger: g('--danger', '#B91C1C'),
    muted: g('--muted', '#475569'), ink2: g('--ink-2', '#334155'), line: '#EEF2F7', axis: '#94A3B8',
    mono: g('--font-mono', 'monospace'), body: g('--font-body', 'sans-serif'),
  };
  return tokenCache;
}

/** Serie de línea. `data` = [{x, y}] (y = null corta la línea). */
export function line(label, data, o = {}) {
  return {
    label, data,
    borderColor: o.color, backgroundColor: o.fillColor ?? o.color,
    borderWidth: o.width ?? 2.5,
    borderDash: DASH[o.dash ?? 'solid'] ?? o.dash,
    borderCapStyle: o.dash === 'dot' ? 'round' : 'butt',
    stepped: o.stepped ?? false,
    tension: 0,
    spanGaps: false,
    fill: o.fill ?? false,
    pointRadius: o.points ?? 0,
    pointHoverRadius: o.points ? o.points + 2 : 3,
    pointStyle: o.pointStyle ?? 'circle',
    pointRotation: o.pointRotation ?? 0,
    pointBorderWidth: o.pointBorderWidth ?? 1,
    pointBackgroundColor: o.pointFill ?? o.color,
    pointBorderColor: o.pointBorder ?? o.color,
    showLine: o.showLine ?? true,
    order: o.order ?? 0,
    hidden: o.hidden ?? false,
  };
}

/** Marcas sueltas (sin línea): puntos, ticks o rectángulos. */
export function marks(label, data, o = {}) {
  return line(label, data, { ...o, showLine: false, points: o.radius ?? 5 });
}

/** Barras sobre eje x lineal. */
export function bars(label, data, o = {}) {
  return {
    type: 'bar', label, data,
    backgroundColor: o.color, borderColor: o.color, borderWidth: 0,
    barThickness: o.thickness ?? 4, order: o.order ?? 0,
  };
}

function axis(spec = {}, t) {
  return {
    type: 'linear',
    min: spec.min, max: spec.max,
    title: { display: !!spec.title, text: spec.title, color: t.ink2, font: { family: t.body, size: 12 } },
    grid: { color: t.line },
    border: { color: t.axis },
    ticks: {
      color: t.muted, font: { family: t.mono, size: 11 }, maxTicksLimit: spec.maxTicks ?? 7,
      callback: spec.format ?? ((v) => fmtNum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)),
    },
  };
}

function buildOptions(spec) {
  const t = tokens();
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    normalized: true,
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    layout: { padding: { top: 6, right: 8 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: (item) => item.raw && item.raw.y != null && !item.dataset.noTooltip,
        callbacks: {
          title: (items) => (items[0] ? `${spec.x?.title ?? 'x'}: ${fmtNum(items[0].parsed.x, spec.x?.tipDigits ?? 1)}` : ''),
          label: (item) => `${item.dataset.label}: ${fmtNum(item.parsed.y, spec.y?.tipDigits ?? 2)}`,
        },
      },
    },
    scales: { x: axis(spec.x, t), y: axis(spec.y, t) },
  };
}

export function createChart(canvas, spec) {
  if (!window.Chart || !canvas) return null;
  return new window.Chart(canvas, {
    type: spec.type ?? 'line',
    data: { datasets: spec.datasets },
    options: buildOptions(spec),
  });
}

export function updateChart(chart, spec) {
  if (!chart) return;
  const t = tokens();
  chart.data = { datasets: spec.datasets };
  chart.options.scales.x = axis(spec.x, t);
  chart.options.scales.y = axis(spec.y, t);
  chart.update('none');
}

/** Crea o actualiza; devuelve la instancia. */
export function upsertChart(existing, canvas, spec) {
  if (existing && existing.canvas === canvas) { updateChart(existing, spec); return existing; }
  if (existing) existing.destroy();
  return createChart(canvas, spec);
}

/** Etiqueta de leyenda HTML (SVG con el mismo trazo que la serie). */
export function legendSwatch({ color, dash = 'solid', width = 3, kind = 'line' }) {
  if (kind === 'tick') return `<svg width="12" height="12" aria-hidden="true"><path d="M6 1 L6 11" stroke="${color}" stroke-width="3"></path></svg>`;
  if (kind === 'rect') return `<svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="${color}"></rect></svg>`;
  if (kind === 'dot') return `<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="#FFFFFF" stroke="${color}" stroke-width="3"></circle></svg>`;
  const d = (DASH[dash] ?? []).join(' ');
  return `<svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="${color}" stroke-width="${width}"${d ? ` stroke-dasharray="${d}"` : ''}${dash === 'dot' ? ' stroke-linecap="round"' : ''}></line></svg>`;
}
