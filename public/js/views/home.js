// Inicio (#/): hero, tarjetas de las 8 simulaciones y pasos.

export const SIMS = [
  { n: '01', cat: 'Mercados', title: 'Oferta y demanda', desc: 'Equilibrio, impuestos, precios máximos y el ajuste dinámico de la telaraña.', route: 'oferta-demanda' },
  { n: '02', cat: 'Finanzas', title: 'Interés compuesto y decisiones financieras', desc: 'Capitalización, aportes periódicos, inflación y comparación de alternativas.', route: 'interes-compuesto' },
  { n: '03', cat: 'Inventarios', title: 'Cantidad económica de pedido', desc: 'El tamaño de lote que equilibra el costo de pedir con el de almacenar.', route: 'eoq' },
  { n: '04', cat: 'Inventarios', title: 'Punto de reorden con demanda variable', desc: 'Inventario de seguridad y nivel de servicio frente a una demanda incierta.', route: 'punto-reorden' },
  { n: '05', cat: 'Inventarios', title: 'Sistemas de revisión', desc: 'Revisión continua (Q, ROP) frente a periódica (T, S) con la misma demanda.', route: 'sistemas-revision' },
  { n: '06', cat: 'Cadena de suministro', title: 'Efecto látigo', desc: 'Cómo pequeñas variaciones del cliente se amplifican aguas arriba.', route: 'efecto-latigo' },
  { n: '07', cat: 'Cadena de suministro', title: 'Beer Game simplificado', desc: 'Juega un rol de la cadena y enfrenta retrasos de pedido y de envío.', route: 'beer-game' },
  { n: '08', cat: 'Servicios', title: 'Teoría de colas y cuellos de botella', desc: 'Filas M/M/1 y M/M/c, ley de Little y la estación que limita el flujo.', route: 'colas' },
];

function template() {
  return `
<div class="view home">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-text">
      <span class="hero-badge">8 simulaciones · gratis · sin registro</span>
      <h1 id="hero-title" tabindex="-1">Mueve un parámetro y mira cómo responde la economía</h1>
      <p>Laboratorio virtual para clase y para la empresa: mercados, decisiones financieras, inventarios, cadenas de suministro y filas de servicio. Cada simulación explica qué hace, qué significa cada parámetro y para qué sirve en los negocios.</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="#/oferta-demanda">Empezar con oferta y demanda</a>
        <a class="btn btn-lg" href="#como-usar">Cómo funciona</a>
      </div>
    </div>
    <figure>
      <svg viewBox="0 0 420 240" role="img" aria-label="Ilustración: dos curvas que se cruzan en un punto de equilibrio">
        <g stroke="#E2E8F0" stroke-width="1"><line x1="40" y1="40" x2="400" y2="40"></line><line x1="40" y1="90" x2="400" y2="90"></line><line x1="40" y1="140" x2="400" y2="140"></line><line x1="40" y1="190" x2="400" y2="190"></line></g>
        <line x1="40" y1="210" x2="400" y2="210" stroke="#94A3B8"></line><line x1="40" y1="20" x2="40" y2="210" stroke="#94A3B8"></line>
        <path d="M60 40 L380 196" stroke="#1D4ED8" stroke-width="3" fill="none"></path>
        <path d="M60 200 L380 50" stroke="#C2410C" stroke-width="3" fill="none" stroke-dasharray="8 5"></path>
        <line x1="219" y1="20" x2="219" y2="210" stroke="#334155" stroke-dasharray="3 4"></line>
        <circle cx="219" cy="118" r="7" fill="#0F172A"></circle>
        <text x="230" y="112" font-family="Inter, sans-serif" font-size="13" fill="#0F172A" font-weight="600">Equilibrio</text>
        <text x="300" y="186" font-family="Inter, sans-serif" font-size="12" fill="#1D4ED8">Demanda</text>
        <text x="300" y="66" font-family="Inter, sans-serif" font-size="12" fill="#C2410C">Oferta</text>
      </svg>
      <figcaption>Las gráficas se recalculan al instante con cada cambio.</figcaption>
    </figure>
  </section>

  <section aria-labelledby="sims-title" style="display:flex;flex-direction:column;gap:16px">
    <h2 id="sims-title" class="section-title">Simulaciones</h2>
    <div class="sim-cards">
      ${SIMS.map((s) => `
      <a class="sim-card" href="#/${s.route}">
        <span class="top"><span class="n">${s.n}</span><span class="pill-cat">${s.cat}</span></span>
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
        <span class="foot"><code>#/${s.route}</code><span class="open" aria-hidden="true">Abrir →</span></span>
      </a>`).join('')}
    </div>
  </section>

  <section id="como-usar" class="card" aria-labelledby="how-title" style="padding:clamp(20px,3vw,32px);gap:16px;border-radius:16px">
    <h2 id="how-title" class="section-title">Cómo funciona</h2>
    <ol class="steps">
      <li><span class="badge-n" aria-hidden="true">1</span><div><h3>Ajusta los parámetros</h3><p>Cada control indica su símbolo, unidad y rango. La gráfica y los indicadores cambian en tiempo real.</p></div></li>
      <li><span class="badge-n" aria-hidden="true">2</span><div><h3>Ejecuta con una semilla</h3><p>Las simulaciones aleatorias usan una semilla: misma semilla, mismo resultado. Ideal para que todo el grupo vea lo mismo.</p></div></li>
      <li><span class="badge-n" aria-hidden="true">3</span><div><h3>Guarda y comparte</h3><p>Guarda escenarios en este navegador o copia un enlace que abre la simulación con tus parámetros cargados.</p></div></li>
    </ol>
  </section>

  <footer class="app-footer">
    <span>SimulacionEcoWeb · uso educativo libre</span>
    <span>HTML, CSS y JavaScript sin compilación · Cloudflare Workers</span>
  </footer>
</div>`;
}

export default { route: '', name: 'viewHome', title: 'Inicio', template, data: null };
