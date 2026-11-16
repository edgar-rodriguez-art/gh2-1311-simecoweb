# SimEcon Lab: handoff de diseño a implementación

App web estática y responsiva con 8 simulaciones económicas: mercados, finanzas, inventarios, cadena de suministro y colas. Este documento es el contrato para que **Claude Code Web** implemente la app a partir de los mockups del canvas de Claude Design.

- **Canvas de diseño:** https://claude.ai/artifact/FUw6Uu1Lgsp8wgp2oEBvLN. Hay un artboard por pantalla, más el sistema de diseño y la vista móvil. Los artboards marcados como interactivos funcionan: tienen sliders, gráficas y botones de ejecutar, pausar y reiniciar.
- **Implementación de referencia incluida** en este paquete: `public/js/sims/*.js`, 9 módulos puros, y `tests/sims.test.js`, con 10 pruebas que pasan con `node --test`. Los valores esperados de este documento salieron de ejecutar esas pruebas. **Usa estos módulos tal cual.** Si cambias un modelo, actualiza la prueba y este documento.

---

## 1. Restricciones del stack (no negociables)

| Capa | Tecnología | Versión fijada | Archivo en `public/vendor/` |
|---|---|---|---|
| Estructura / UI | HTML5 semántico | Estándar vivo | — |
| Estilos | CSS nativo: variables, nesting, container queries y `clamp()` | Navegadores modernos (últimas 2 versiones) | — |
| Lógica de simulación | JavaScript ES2022 con módulos ES (`<script type="module">`) | ES2022 | — |
| Reactividad | Alpine.js | **3.17.5** (último parche de 3.17) | `alpine-3.17.5.min.js` ← `alpinejs@3.17.5/dist/cdn.min.js` |
| Gráficas | Chart.js, build **UMD** | **4.5.1** | `chart-4.5.1.umd.min.js` ← `chart.js@4.5.1/dist/chart.umd.min.js` |
| Fórmulas | KaTeX | **0.19.1** | `katex-0.19.1/katex.min.js`, `katex.min.css`, `fonts/`, `contrib/auto-render.min.js` |
| Animaciones | SVG nativo + `requestAnimationFrame` | — | — |
| Aleatoriedad | mulberry32, Box-Muller, exponencial y Poisson propios (`js/sims/rng.js`) | — | — |
| Navegación | Rutas con hash (`#/eoq`) | — | — |
| Persistencia | `localStorage` + parámetros en la URL | — | — |
| Pruebas | `node --test` sobre los módulos puros | Node **24 LTS** | — |
| Hosting | Cloudflare Workers con Static Assets (solo assets, sin script) | Wrangler **≥ 4.34** (fijado `^4.34.0`) | — |

**Reglas:**

1. **Sin compilación.** No uses bundler, transpilador, Tailwind, TypeScript, JSX ni PostCSS. Lo que está en `public/` es exactamente lo que se sirve.
2. **Sin frameworks SPA** (React, Vue, Svelte, etc.). Alpine solo enlaza el DOM con el estado (`x-data`, `x-model`, `x-text`, `x-show`, `x-for`).
3. **Rutas por hash** (`#/ruta?param=valor`). Por eso no se necesitan reglas de SPA ni redirecciones en Cloudflare.
4. **Dependencias de terceros dentro del repo,** en `public/vendor/`, con la versión en el nombre del archivo. No uses un CDN en runtime, así la app funciona igual en un aula con red limitada. Las rutas de origen de la tabla se verificaron en los paquetes npm.
5. Chart.js debe ser el build **UMD** (`window.Chart`). No uses el ESM, porque importa `@kurkle/color`.
6. Los módulos de `js/sims/` son **puros**: reciben un objeto de parámetros y devuelven datos. No acceden al DOM, a `window` ni a `Date.now()`, ni usan `Math.random()`. Toda la aleatoriedad pasa por `mulberry32(seed)`.
7. Nota: npm ya publica Chart.js 4.6.1. Se mantiene **4.5.1** porque así lo fija el stack. Actualizarlo es una decisión aparte.

---

## 2. Estructura del repositorio

```
/
├─ .node-version              → 24
├─ package.json               → solo devDependency wrangler y script "test"
├─ wrangler.jsonc
├─ README.md
├─ tests/
│  └─ sims.test.js            (incluido)
└─ public/                    ← directorio de assets que sube Wrangler
   ├─ index.html              (shell único: header, nav, <main id="view">)
   ├─ 404.html
   ├─ css/
   │  ├─ tokens.css           (sección 7)
   │  ├─ base.css             (reset, tipografía, foco, formularios)
   │  └─ components.css       (tarjeta, slider, kpi, runbar, chart-card, nav)
   ├─ js/
   │  ├─ app.js               (arranque: router, Alpine.start())
   │  ├─ router.js            (hash → vista; parseo de query)
   │  ├─ store.js             (URL ⇄ estado; localStorage)
   │  ├─ ui/
   │  │  ├─ charts.js         (fábrica de Chart.js con tokens y tabla alternativa)
   │  │  ├─ math.js           (render KaTeX de [data-tex])
   │  │  ├─ runner.js         (máquina de estados: reiniciada/corriendo/pausa/completada)
   │  │  └─ components.js     (Alpine.data para slider, kpi, runbar)
   │  ├─ views/               (una por sección: plantilla HTML + Alpine.data)
   │  │  ├─ home.js  supplyDemand.js  compoundInterest.js  eoq.js
   │  │  ├─ reorderPoint.js  reviewSystems.js  bullwhip.js  beerGame.js  queues.js
   │  └─ sims/                (incluidos; NO tocan el DOM)
   │     ├─ rng.js  supplyDemand.js  compoundInterest.js  eoq.js  reorderPoint.js
   │     └─ reviewSystems.js  bullwhip.js  beerGame.js  queues.js
   └─ vendor/                 (sección 1)
```

> Este paquete ya trae esa estructura: `public/js/sims/`, `tests/` (que importa `../public/js/sims/…`), `package.json`, `.node-version` y `wrangler.jsonc`. Ejecuta `node --test` desde la raíz.

---

## 3. Arquitectura en tiempo de ejecución

- **`index.html`** carga primero `vendor/chart…umd.min.js` y `vendor/katex…/katex.min.js` (clásicos, con `defer`), después `js/app.js` (`type="module"`) y al final `vendor/alpine…min.js` (`defer`). Los componentes se registran en `alpine:init`, antes de que Alpine arranque.
- **Router (`router.js`):** escucha `hashchange`. Formato: `#/<ruta>?k=v&k2=v2`. Si la ruta no existe, redirige a `#/`. Monta la vista en `<main id="view">`, actualiza `document.title`, marca `aria-current="page"` en la navegación y mueve el foco al `<h1>` de la vista.
- **Estado y URL (`store.js`):**
  - Cada vista declara su esquema de parámetros (sección 5). Con él se leen los valores de la query, se validan y se acotan al rango; si un valor es inválido, se usa el de por defecto.
  - Cada cambio actualiza la URL con `history.replaceState` (sin crear entradas de historial) tras 250 ms de espera.
  - **Copiar enlace** copia `location.href` al portapapeles y avisa con un toast `role="status"`.
  - **Guardar escenario** pide un nombre y guarda en `localStorage["simecon:v1:scenarios"] = { "<ruta>": [{ name, params, seed, savedAt }] }`. Cada sección muestra la lista de escenarios guardados, con las acciones **cargar** y **borrar**. Hay que envolver la lectura y la escritura en `try/catch`: si `localStorage` no está disponible, la app sigue funcionando sin guardar.
  - `seed` es un parámetro global en la URL (`&seed=42`; vale 42 por defecto) y se edita en el campo «Semilla» del header.
- **Vista = Alpine.data:** `params` (reactivo, ligado con `x-model.number`), `result` (salida de `js/sims/…`, recalculada con `$watch` sobre `params` en un `requestAnimationFrame`) y referencias a las gráficas. Las gráficas se actualizan con `chart.data = …; chart.update('none')`, sin destruirlas ni volver a crearlas.
- **Runner (`runner.js`):** solo en las simulaciones dinámicas (sección 4). Estados: `reset → running ⇄ paused → done`. Cada tick avanza `k` y la gráfica muestra `result.slice(0, k)`. Los ticks van a 50–400 ms según la sección. **El resultado completo se calcula una sola vez** con el módulo puro y la animación solo lo revela; así la semilla garantiza el mismo resultado se anime o no. Con `prefers-reduced-motion: reduce`, «Ejecutar» salta directo a `done`.
- **KaTeX (`math.js`):** cada fórmula vive en `<span data-tex="…">` y se renderiza con `katex.render(tex, el, { throwOnError: false })` al montar la vista. Las cadenas TeX están en la sección 5.

---

## 4. Mapa de pantallas → módulos

| # | Ruta | Artboard en el canvas | Módulo puro | Vista | Componentes | Gráficas (Chart.js) | Dinámica |
|---|---|---|---|---|---|---|---|
| — | `#/` | `Main` | — | `views/home.js` | hero, tarjeta de simulación ×8, pasos | — (SVG decorativo) | No |
| 1 | `#/oferta-demanda` | `OfertaDemanda` | `sims/supplyDemand.js` | `views/supplyDemand.js` | slider ×7, kpi ×6, chart-card ×2, runbar, tabla de parámetros | `scatter` con líneas (Q en x, P en y): demanda, oferta, oferta sin impuesto, telaraña, punto E, línea P̄ · `line`: precio por período | Sí (telaraña, 300 ms/período) |
| 2 | `#/interes-compuesto` | `InteresCompuesto` | `sims/compoundInterest.js` | `views/compoundInterest.js` | slider ×6, select n, kpi ×6, chart-card, aviso de decisión | `line`: compuesto, alt. B, simple, real, aportado | No |
| 3 | `#/eoq` | `Eoq` (+ `MovilEoq`) | `sims/eoq.js` | `views/eoq.js` | slider ×4, botón «Usar Q*», kpi ×5, chart-card ×2 | `line` (x numérico): costo de pedir, de mantener y total, con marcas en Q* y Q · `line`: diente de sierra Q* vs Q | No |
| 4 | `#/punto-reorden` | `PuntoReorden` | `sims/reorderPoint.js` | `views/reorderPoint.js` | slider ×5, select NS, kpi ×5, chart-card, runbar | `line` escalonada: inventario a mano, ROP, SS, marcas de pedido y de faltante | Sí (50 ms/día) |
| 5 | `#/sistemas-revision` | `SistemasRevision` | `sims/reviewSystems.js` | `views/reviewSystems.js` | slider ×6, select NS, tabla comparativa, chart-card ×2, runbar | `line` escalonada: continua vs periódica + días de revisión · `bar`: tamaño de pedido por día | Sí (50 ms/día) |
| 6 | `#/efecto-latigo` | `EfectoLatigo` | `sims/bullwhip.js` | `views/bullwhip.js` | diagrama de cadena (5 nodos), slider ×5, switch «compartir información», chart-card, barras de amplificación, runbar | `line`: cliente + 4 eslabones · barras HTML en escala log con marca de cota | Sí (120 ms/semana) |
| 7 | `#/beer-game` | `BeerGame` | `sims/beerGame.js` | `views/beerGame.js` | cadena animada (SVG + rAF), select de modo/rol, select de demanda, slider ×5, panel «Tu turno», kpi ×4, chart-card ×2, runbar | `line`: pedidos por rol + demanda · `line`: inventario neto por rol (línea en 0) | Sí (400 ms/semana; pausa automática en el turno del jugador) |
| 8 | `#/colas` | `Colas` | `sims/queues.js` | `views/queues.js` | slider ×7, alerta de inestabilidad, kpi ×5, fila animada (SVG + rAF), chart-card ×2, tarjetas de estación ×3, runbar | `line` escalonada: cola simulada vs Lq · `line`: L contra ρ con punto actual | Sí (60 ms por cada 3 min simulados) |

Cada sección incluye, en este orden: encabezado (categoría, módulo, estado, h1, párrafo «qué simula»), parámetros, indicadores, gráficas, **Modelo** (fórmulas KaTeX y reglas), **Utilidad en los negocios** y **Parámetros y sus efectos** (tabla con símbolo, significado y «si aumenta…»). Los textos de los mockups son el contenido final en español: cópialos tal cual.

---

## 5. Contrato de cada simulación

Notación: *rango* = `[mín, máx]`, *paso*, **defecto**. Todos los parámetros viajan en la URL con el `id` indicado.

### 5.1 Oferta y demanda (`supplyDemand.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `a` | a | [60, 200] · 1 | **120** | unidades |
| `b` | b | [0.5, 6] · 0.1 | **3** | u por $ |
| `c` | c | [−40, 0] · 1 | **0** | unidades |
| `d` | d | [0.5, 6] · 0.1 | **2** | u por $ |
| `t` | t | [0, 20] · 0.5 | **0** | $/u |
| `pmax` | P̄ | [0, 60] · 1 (0 = sin tope) | **0** | $ |
| `p0` | P₀ | [0, 60] · 1 | **10** | $ |

- **Modelo:** `Qd = a − b·P`; `Qs = c + d·(P − t)`; ambas acotadas en ≥ 0.
- **Fórmulas:** `P* = (a − c + d·t)/(b + d)`; `Q* = a − b·P*`; `Pp = P* − t`; `EC = ½·Q*·(a/b − P*)`; `EP = ½·Q*·(Pp + c/d)`; `recaudo = t·Q*`; `PIE = ½·t·(Q₀ − Q*)`, donde Q₀ es la cantidad sin impuesto.
- **Precio máximo:** si `0 < P̄ < P*`, entonces `escasez = Qd(P̄) − Qs(P̄)`.
- **Telaraña (30 períodos):** `Qs_k = c + d·(P_{k−1} − t)` y `P_k = max(0, (a − Qs_k)/b)`. Régimen: `d/b < 1` converge, `= 1` cicla, `> 1` diverge.
- **API:** `equilibrium(p)`, `priceCeiling(p, pmax)`, `cobweb(p, {P0, periods})`, `curves(p)`.
- **Salidas → UI:** P*, Pp, Q*, EC, EP, recaudo, PIE y escasez van a los KPI; `curves` alimenta la gráfica 1; `cobweb.path` alimenta la gráfica 2 y la línea de telaraña de la gráfica 1; `regime` es la etiqueta de color (verde #166534 si converge, ámbar #854D0E si cicla, rojo #B91C1C si diverge).
- **TeX:** `P^* = \frac{a - c + d\,t}{b + d}`, `Q^* = a - bP^*`, `P_k = \frac{a - Q^s_k}{b}`.

### 5.2 Interés compuesto (`compoundInterest.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `P` | P | [0, 100000] · 500 | **10000** | $ |
| `r` | r | [0, 20] · 0.25 | **8** | % anual (el módulo recibe la fracción: `r/100`) |
| `n` | n | {1, 2, 4, 12, 365} | **12** | capitalizaciones por año |
| `t` | t | [1, 40] · 1 | **10** | años |
| `A` | A | [0, 2000] · 50 | **0** | $ por período, al final del período |
| `inf` | π | [0, 10] · 0.5 | **4** | % anual |
| `rB` | r_B | [0, 20] · 0.25 | **6** | % anual |

- **Fórmulas:** `VF = P(1 + r/n)^{nt} + A·[(1 + r/n)^{nt} − 1]/(r/n)` (con r = 0: `P + A·n·t`); `TEA = (1 + r/n)^n − 1`; años para duplicar `= ln 2 / (n·ln(1 + r/n))`; regla del 72 `= 72/r%`; `real = VF/(1 + π)^t`; interés simple `= P(1 + r·t) + A·n·t`.
- **API:** `futureValue`, `summary`, `series`, `effectiveAnnualRate`, `rule72`, `realValue`, `continuous`.
- **Salidas → UI:** `summary` alimenta los KPI y la frase de decisión: «la alternativa A/B entrega $X más…» y una advertencia si `π ≥ TEA`. `series` alimenta la gráfica con 5 series (estilos de la sección 7).
- **TeX:** `VF = P\left(1+\tfrac{r}{n}\right)^{nt} + A\,\frac{(1+r/n)^{nt}-1}{r/n}`, `TEA = \left(1+\tfrac{r}{n}\right)^{n}-1`.

### 5.3 EOQ (`eoq.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `D` | D | [100, 20000] · 100 | **1200** | u/año |
| `S` | S | [5, 500] · 5 | **50** | $/pedido |
| `H` | H | [0.5, 50] · 0.5 | **2** | $/u·año |
| `Q` | Q | [20, 2000] · 5 | **round(Q*)** (si falta en la URL se usa Q*) | u |

- **Fórmulas:** `Q* = √(2DS/H)`; `CT(Q) = (D/Q)·S + (Q/2)·H`; `N = D/Q*`; `T = Q*/D × 360` días; `sobrecosto% = (CT(Q)/CT(Q*) − 1)·100`.
- **API:** `eoq`, `totalCost`, `summary`, `costCurve(p, qMin, qMax, steps)`, `sawtooth(p, Q, horizonDays)`.
- **Salidas → UI:** los KPI; `costCurve` alimenta la gráfica 1, que usa `qMax = max(2000, 1.1·Q, 2.5·Q*)` y marca Q* con una línea vertical y Q con un círculo; `sawtooth` (Q* y Q) alimenta la gráfica 2.
- **TeX:** `Q^* = \sqrt{\frac{2DS}{H}}`, `CT(Q) = \frac{D}{Q}S + \frac{Q}{2}H`.

### 5.4 Punto de reorden (`reorderPoint.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `dbar` | d̄ | [5, 100] · 1 | **20** | u/día |
| `sigma` | σd | [0, 30] · 0.5 | **5** | u/día |
| `L` | L | [1, 30] · 1 | **4** | días |
| `sl` | NS | {80, 85, 90, 95, 97.5, 99, 99.9} | **95** | % (el módulo recibe la fracción) |
| `Q` | Q | [50, 600] · 10 | **200** | u |
| `days` | N | [30, 365] · 5 | **120** | días |

- **Fórmulas:** `z = Φ⁻¹(NS)` con `zFromService`; `SS = z·σd·√L`; `ROP = d̄·L + SS`.
- **Simulación diaria** (ventas perdidas, demanda `max(0, round(N(d̄, σd)))` con semilla):
  1. llegan los pedidos programados para el día t;
  2. se atiende la demanda; el faltante se pierde;
  3. si `a mano + en tránsito ≤ ROP`, se pide Q, que llega el día `t + L + 1`.
  - El inventario inicial es `round(ROP + Q/2)`.
- **Salidas:** `rop`, `ss`, `rows[] {t, demand, onHand, ordered, stockout}`, `orders`, `lost`, `fillRate`, `cycleService`, `avgInventory`, `stockoutDays`.
- **Gráfica:** escalonada (`stepped: true`), con ROP (guiones naranja), SS (puntos verde azulado), pedidos (ticks violeta) y faltantes (barras rojas en el eje).
- **Nota pedagógica:** el ciclo sin faltante observado suele quedar **por debajo** del objetivo (54.5 % con los valores por defecto). La revisión es diaria, el inventario cruza el ROP con un sobrepaso de hasta un día de demanda, y la muestra tiene pocos ciclos. La tasa de surtido (97.9 %) es el KPI principal. El texto del mockup ya lo explica: no lo «corrijas» cambiando el modelo.
- **TeX:** `ROP = \bar d\,L + z\,\sigma_d\sqrt{L}`.

### 5.5 Revisión continua vs periódica (`reviewSystems.js`)

Usa los mismos `dbar`, `sigma`, `L` (rango [1, 20]), `sl` ({90, 95, 97.5, 99}), `Q` y `days` de 5.4, más:

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `T` | T | [1, 30] · 1 | **7** | días |

- **Periódica:** `S = d̄(T + L) + z·σd·√(T + L)`; al cierre del día t, si `(t + 1) % T === 0`, se pide `max(0, round(S − a mano − en tránsito))`. El inventario inicial es `round(S − d̄·T/2)`.
- `compare(p)` genera **una sola** serie de demanda con la semilla y la pasa a ambas políticas.
- **Salidas → UI:** la tabla comparativa (nivel ROP/S, SS, pedidos, inventario promedio, tasa de surtido, días con faltante); la gráfica 1 con ambos inventarios y líneas verticales en los días de revisión; la gráfica 2 con barras de pedidos (continua desplazada −3 px y periódica +3 px).
- **TeX:** `S = \bar d\,(T+L) + z\,\sigma_d\sqrt{T+L}`.

### 5.6 Efecto látigo (`bullwhip.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `mu` | μ | [50, 200] · 5 | **100** | u/sem |
| `sigma` | σ | [0, 40] · 1 | **10** | u/sem |
| `L` | L | [1, 8] · 1 | **2** | sem |
| `p` | p | [2, 20] · 1 | **5** | sem |
| `periods` | N | [20, 104] · 4 | **52** | sem |
| `share` | — | booleano | **false** | — |

- **Regla por eslabón k = 0…3:** observa los pedidos entrantes `D_t` (el minorista ve la demanda del cliente, `max(0, N(μ, σ))`); `F_t` = promedio de los últimos `p` (o de los disponibles); `S_t = F_t(L + 1)`; `q_t = max(0, D_t + S_t − S_{t−1})`, con `S_{−1} = μ(L + 1)`. Si `share = true`, el pronóstico usa la demanda del cliente en lugar de los pedidos entrantes.
- Hay un calentamiento de 10 períodos que se descarta antes de medir.
- **Salidas:** `customer[]`, `orders[4][]`, `ratios[4] = Var(q_k)/Var(D)` (varianza muestral), `stageBound = 1 + 2L/p + 2L²/p²`, `cumulativeBound[k] = stageBound^(k+1)`.
- **Gráficas:** líneas (cliente + 4 eslabones) y barras HTML con ancho `log10(ratio)/log10(máx)`; la marca punteada es la cota (acumulada, o aditiva `1 + (k+1)(cota − 1)` si se comparte información).
- **TeX:** `\frac{Var(q)}{Var(D)} \ge 1 + \frac{2L}{p} + \frac{2L^2}{p^2}`.

### 5.7 Beer Game (`beerGame.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `role` | — | {−1 auto, 0 Minorista, 1 Mayorista, 2 Distribuidor, 3 Fábrica} | **−1** | — |
| `dm` (`demandMode`) | — | {`poisson`, `escalon`} | **poisson** | — |
| `lambda` | λ | [2, 12] · 1 | **4** | cajas/sem |
| `alpha` | α | [0, 1] · 0.05 | **0.3** | — |
| `beta` | β | [0, 1] · 0.05 | **0.3** | — |
| `theta` | θ | [0.05, 1] · 0.05 | **0.25** | — |
| `weeks` | N | [20, 52] · 1 | **36** | sem |

Constantes: retraso de pedido 1 semana, retraso de envío y producción 2 semanas, inventario inicial 12, `S* = 12`, costo de inventario $0.50/caja·sem, costo de pendiente $1.00/caja·sem. El escalón va de 4 a 8 a partir de la semana 5.

- **Estado por rol:** `stock` (físico), `backlog` (pendiente), `inv = stock − backlog`, `ship[]` (envíos en camino, longitud 2), `orders[]` (pedidos en camino al proveedor, longitud 1), `expected`, `outstanding` (pedido acumulado − recibido; **incluye los pendientes del proveedor**).
- **Una semana (`step`):**
  1. cada rol recibe `ship.shift()`;
  2. los pedidos entrantes son: clientes → minorista, y `orders.shift()` de cada rol → su proveedor;
  3. cada rol envía `min(stock, entrante + backlog)` al rol de abajo (`ship.push`); la fábrica produce lo que pidió (`ship.push(pedido)`);
  4. decisión: `Ê = θ·D + (1 − θ)·Ê`; `O = max(0, round(Ê + α[(S* − I) + β(Ê·(dO + dS − 1) − SL)]))`. El jugador humano reemplaza `O` en su rol.
- **API:** `init(params)`, `step(state, {[rol]: pedido})`, `run(params)`, `summarize(state)` → `ratios[4]`, `costByRole[4]`, `totalCost`.
- **UI:** con `role ≥ 0`, el runner se **pausa** al inicio de cada semana y muestra el panel «Tu turno». El panel muestra el pedido recibido, el inventario neto, lo que está en camino y la sugerencia de la regla. El campo numérico (por defecto, la sugerencia) se confirma con «Enviar pedido»; «Paso» usa la sugerencia.
- **Animación de la cadena:** SVG con 4 nodos. Las cajas viajan a la derecha (envíos) y las órdenes a la izquierda (pedidos), interpolando con `requestAnimationFrame` durante el tick.
- **TeX:** `O_t = \max\!\left(0,\ \hat E_t + \alpha\left[(S^*-I_t) + \beta(\hat E_t\,2 - SL_t)\right]\right)`.

### 5.8 Colas y cuello de botella (`queues.js`)

| id | Símbolo | Rango · paso | Defecto | Unidad |
|---|---|---|---|---|
| `lambda` | λ | [0.5, 20] · 0.5 | **4** | clientes/h |
| `mu` | μ | [1, 20] · 0.5 | **5** | clientes/h por servidor |
| `c` | c | [1, 5] · 1 | **1** | servidores |
| `hours` | H | [1, 24] · 1 | **8** | h |
| `m1`, `m2`, `m3` | μ₁…₃ | [1, 20] · 0.5 | **6, 4.5, 5** | u/h |

- **M/M/1:** `ρ = λ/μ`, `L = ρ/(1 − ρ)`, `Lq = ρ²/(1 − ρ)`, `W = 1/(μ − λ)`, `Wq = ρ/(μ − λ)`. **M/M/c:** Erlang C (`mmc`). Si `ρ ≥ 1`, devuelve `stable: false`; la UI muestra la alerta y oculta los valores teóricos (∞).
- **Simulación por eventos:** llegadas `exponential(λ)` y servicio `exponential(μ)`; cada llegada va al servidor que se libera primero. La línea de tiempo se muestrea cada 0.05 h (3 min): `queue` (esperando) y `system`.
- **Cuello de botella:** `X = min(λ, cᵢ·μᵢ)`; cuello = la estación de menor capacidad; `uᵢ = X/capᵢ`; si `λ > capacidad mínima`, la fila crece `λ − cap_min` u/h.
- **Gráficas:** cola simulada (escalonada) con línea Lq; curva L(ρ) para ρ ∈ [0.05, 0.95] con el punto actual.
- **Nota:** en 8 h con el sistema vacío al inicio, la espera simulada (13.3 min con semilla 42) es menor que la de estado estable (Wq = 48 min). Es un punto de discusión en clase, no un error.
- **TeX:** `\rho = \frac{\lambda}{c\mu}`, `L = \frac{\rho}{1-\rho}`, `W = \frac{1}{\mu-\lambda}`, `L = \lambda W`.

---

## 6. Casos de prueba (resultado esperado)

Todos están en `tests/sims.test.js` y **pasan** (`node --test` → 10/10). La tolerancia es ±0.01 salvo donde se indica.

| Módulo | Entrada | Esperado |
|---|---|---|
| rng | `mulberry32(42)` primeras 2 salidas | 0.6011037519, 0.4482905590 |
| rng | `zFromService(0.95)` / `(0.99)` | 1.6449 / 2.3263 |
| Oferta y demanda | a=120, b=2, c=0, d=2 | P* = 30, Q* = 60, EC = 900, EP = 900 |
| Oferta y demanda | … con t = 4 | P = 32, Pp = 28, Q = 56, recaudo = 224, PIE = 8 |
| Oferta y demanda | a=120, b=3, c=0, d=2, P̄ = 18 | escasez = 30 (Qd 66, Qs 36) |
| Telaraña | a=120, b=3, d=2, P₀=10, 30 períodos | converge, P₃₀ ≈ 24.000 |
| Telaraña | b=2, d=3 | `diverge` |
| Interés | P=10 000, r=8 %, n=12, t=10 | VF = 22 196.40 |
| Interés | P=1 000, r=10 %, n=1, t=2 | 1 210 |
| Interés | P=0, A=100, r=12 %, n=12, t=1 | 1 268.25 |
| Interés | TEA(8 %, 12) · valor real con π = 4 % | 8.30 % · 14 995.09 |
| **EOQ** | **D = 1 200, S = 50, H = 2** | **Q\* ≈ 244.95**, N = 4.90, T = 73.48 días, CT = 489.90 |
| EOQ | … con Q = 400 | CT = 550, sobrecosto 12.27 % |
| ROP | d̄=20, σ=5, L=4, NS=95 % | SS = 16.45, ROP = 96.45 |
| ROP (sim) | … Q=200, 120 días, semilla 42 | 12 pedidos, 50 u perdidas, fill rate 0.9789 |
| Revisión | … T=7 | S = 247.28, SS = 27.28; periódica 17 pedidos vs continua 12; SS periódica > continua |
| Látigo | μ=100, σ=10, L=2, p=5, 52 sem, semilla 42 | cota por eslabón 2.12; ratios crecientes (3.35, 13.13, 47.54, 136.94); compartir información reduce la fábrica (21.76 < 136.94) |
| **Beer Game** | **valores por defecto, semilla 42 (Poisson λ=4)** | **amplificación medible:** ratios Var(pedidos)/Var(demanda) estrictamente crecientes 0.84 → 1.51 → 2.63 → **4.29** (fábrica); costo total $961.50 |
| Beer Game | `demandMode: 'escalon'` | costo total $2 673.50 |
| **M/M/1** | **λ = 4, μ = 5** | **ρ = 0.8, L = 4**, Lq = 3.2, W = 1 h, Wq = 0.8 h; Little L = λW |
| M/M/c | λ=8, μ=5, c=2 | Pw = 0.7111, Lq = 2.8444, L = 4.4444 |
| M/M/1 | λ = μ = 5 | `stable: false` |
| Cuello de botella | λ=5, μ = (6, 4, 5) | cuello = estación 2, X = 4, la fila crece 1 u/h |

**Prueba de UI recomendada (manual o con Playwright, opcional):** abrir `#/eoq?D=1200&S=50&H=2` debe mostrar «Q* óptima 244.9» (formato `es-MX`, un decimal) y «Costo total con Q* $489.90».

---

## 7. Tokens de diseño, breakpoints y estados

### 7.1 `css/tokens.css`

```css
:root {
  /* color */
  --ink: #0F172A;        /* texto principal 17:1 */
  --ink-2: #334155;      /* texto secundario 10:1 */
  --muted: #475569;      /* etiquetas 7.6:1 */
  --line: #E2E8F0;  --line-soft: #F1F5F9;
  --bg: #F4F6F9;    --surface: #FFFFFF;  --surface-2: #F8FAFC;
  --primary: #1D4ED8;  --primary-ink: #1E3A8A;  --primary-soft: #DBEAFE;
  --accent: #C2410C;   --accent-ink: #9A3412;   --accent-soft: #FFEDD5;
  --series-1: #1D4ED8; /* continua */
  --series-2: #C2410C; /* guiones 8 5 */
  --series-3: #0F766E; /* puntos 2 4 */
  --series-4: #6D28D9; /* guion-punto 10 4 2 4 */
  --series-ref: #0F172A; --series-neutral: #64748B;
  --ok-ink: #166534;   --ok-bg: #DCFCE7;   --ok-dot: #16A34A;
  --warn-ink: #854D0E; --warn-bg: #FEF9C3; --warn-dot: #CA8A04;
  --danger: #B91C1C;   --danger-bg: #FEE2E2;
  --header-bg: #0F172A; --header-2: #1E293B;
  /* tipografía */
  --font-display: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --fs-h1: clamp(28px, 3.2vw, 38px); --fs-h2: 20px; --fs-h3: 17px;
  --fs-body: 16px; --fs-sm: 14px; --fs-xs: 12px; --lh: 1.6;
  /* espacio, radios, objetivos */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --r-control: 8px; --r-btn: 10px; --r-card: 14px; --r-pill: 999px;
  --target-min: 44px;
  --focus: 3px solid var(--primary);
  --container: 1440px; --nav-w: 260px; --params-w: 380px;
}
```

Las fuentes (Inter, Space Grotesk y JetBrains Mono; todas con licencia OFL) se guardan en `public/fonts/` como woff2 con `font-display: swap`. Si se prefiere no alojarlas, se usa la pila del sistema. **No uses Google Fonts en runtime.** En los mockups los valores numéricos usan `font-variant-numeric: tabular-nums` y el formato `toLocaleString('es-MX')`: `1,200.50`.

### 7.2 Breakpoints (container queries sobre `.sim-layout`, con media queries de respaldo)

| Nombre | Ancho | Layout |
|---|---|---|
| Móvil | < 640 px | Una columna. La navegación es un `<select>` en el header, como en el artboard `MovilEoq`. El orden es: título → parámetros → KPI (2 columnas) → gráficas → explicaciones en `<details>`. La barra de ejecución y la de guardar/compartir quedan fijas abajo (`position: sticky; bottom: 0`). Sliders con altura de 32 px. |
| Tableta | 640–1023 px | Menú plegable (`<details>` o botón con `aria-expanded`) arriba. Parámetros y gráficas en 2 columnas (`minmax(280px, 1fr) 1.6fr`); explicaciones a ancho completo. |
| Escritorio | ≥ 1024 px | Navegación lateral de 260 px, parámetros de 300–380 px y gráficas con el resto. Contenedor máximo de 1440 px. Se implementa con `flex-wrap`, igual que los mockups. |

### 7.3 Estados de la simulación (artboard `Tokens`, sección «Estados»)

| Estado | Píldora `role="status"` | Botón primario | Paso | Reiniciar | Controles |
|---|---|---|---|---|---|
| Reiniciada (`k = 0`) | gris · «Reiniciada · semana 0 de N» | **Ejecutar** ▶ | activo | deshabilitado | todos editables |
| Corriendo | verde · «Corriendo · semana k de N» | **Pausar** ❚❚ | deshabilitado | activo | los que cambian la estructura (periodos, semilla) quedan deshabilitados; un cambio de parámetro reinicia la corrida |
| En pausa (`0 < k < N`) | ámbar · «En pausa · semana k de N» | **Reanudar** ▶ | activo | activo | editables (un cambio reinicia la corrida) |
| Completada (`k = N`) | azul · «Completada · N semanas» | **Ejecutar** (vuelve a empezar desde 0) | — | activo | editables |

La unidad del texto cambia por sección: período, día, semana o paso. La barra de progreso es `width = k/N` (ámbar en pausa). Al cargar una sección dinámica, el estado inicial es **Completada**, para que la gráfica muestre el resultado completo sin necesidad de ejecutar.

---

## 8. Accesibilidad (WCAG 2.2 AA)

- **Sliders:** `<label for>` visible con el nombre y el símbolo, `<input type="range">` con `aria-valuetext="1,200 u/año"`, y `<output for>` con el valor y la unidad. Los extremos del rango se muestran debajo. Un campo numérico alternativo (doble clic en el valor o un botón «editar») permite escribir el valor exacto.
- **Selects y switches:** elementos nativos (`<select>`, `<input type="checkbox">`) con su `<label>`.
- **Gráficas:**
  - `<canvas role="img" aria-label="…">` con una frase de resumen calculada (los mockups traen el texto de cada `alt`).
  - Debajo, un `<details><summary>Ver datos de la gráfica</summary><table>…</table></details>` con una tabla real (`<th scope="col">`).
  - Las series se distinguen por trazo (`borderDash`) además del color, y la leyenda está en HTML.
- **KPI:** contenedor `aria-live="polite"` con un retardo de 400 ms, para no saturar los lectores de pantalla.
- **Contraste:** todos los textos ≥ 4.5:1 sobre su fondo (valores en la sección 7.1). Las líneas de gráficas son ≥ 3:1 contra el blanco.
- **Foco:** `:focus-visible` con un contorno de 3 px `--primary` separado 2 px. Todos los objetivos táctiles miden ≥ 44 × 44 px. Al cambiar de ruta, el foco va al `<h1>`. Hay un enlace «Saltar al contenido» al inicio.
- **Movimiento:** con `prefers-reduced-motion: reduce` no se anima la cadena ni la fila; «Ejecutar» muestra el resultado final.
- **Idioma:** `<html lang="es">`.

---

## 9. Despliegue en Cloudflare

### 9.1 Archivos

**`wrangler.jsonc`** (Worker solo con assets: **sin `main`**):

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "simecon-lab",
  "compatibility_date": "2026-11-16",
  "assets": {
    "directory": "./public",
    "not_found_handling": "404-page"
  }
}
```

**`.node-version`**

```
24
```

**`package.json`**

```json
{
  "name": "simecon-lab",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.34.0"
  }
}
```

> Se fija Wrangler en `devDependencies` para que `npx wrangler deploy` use una versión ≥ 4.34. No hay paso de build de la app.

### 9.2 Workers Builds (Cloudflare → Workers & Pages → Create → Import a repository)

| Campo | Valor |
|---|---|
| Repositorio | el repo de GitHub, rama `main` |
| Root directory | `/` |
| Build command | *(vacío)* |
| Deploy command | `npx wrangler deploy` |
| Variables | ninguna (Node lo toma de `.node-version`) |
| URL | `https://simecon-lab.<subdominio>.workers.dev` |

Con cada push a `main` se despliega solo. Para hacerlo a mano desde una terminal: `npm ci && npx wrangler login && npx wrangler deploy`.

### 9.3 Alternativa: Cloudflare Pages

En Create → Pages → Connect to Git: *Framework preset* None, *Build command* vacío, *Build output directory* `public`. No hace falta `wrangler.jsonc`.

---

## 10. Criterios de aceptación

**Globales (aplican a todas las secciones)**

- [ ] `public/` se sirve sin compilar. No hay `import` hacia `node_modules` ni peticiones a dominios externos en runtime: en la pestaña Red, todo es del mismo origen.
- [ ] Las versiones de `vendor/` coinciden con la sección 1 (Alpine 3.17.5, Chart.js 4.5.1 UMD, KaTeX 0.19.1).
- [ ] Las rutas `#/`, `#/oferta-demanda`, `#/interes-compuesto`, `#/eoq`, `#/punto-reorden`, `#/sistemas-revision`, `#/efecto-latigo`, `#/beer-game` y `#/colas` funcionan con los botones atrás y adelante. Una ruta desconocida lleva a `#/`.
- [ ] Al mover un parámetro, la URL se actualiza. Al recargar o abrir esa URL en otra pestaña, se ve el mismo estado.
- [ ] «Copiar enlace» copia la URL completa y lo confirma con un toast.
- [ ] «Guardar escenario» lo guarda en `localStorage`; se puede cargar y borrar; sobrevive a una recarga. Si `localStorage` falla, no hay errores en la consola.
- [ ] Misma semilla y mismos parámetros dan los mismos números en los KPI, con o sin animación.
- [ ] Con 360, 768 y 1280 px de ancho no hay scroll horizontal, salvo en las tablas, que tienen su propio contenedor con scroll.
- [ ] Cada sección tiene «qué simula», tabla de parámetros y efectos, «Modelo» con KaTeX renderizado y «Utilidad en los negocios».
- [ ] Lighthouse (móvil): Accesibilidad ≥ 95 y Buenas prácticas ≥ 95. Navegación completa con teclado.
- [ ] `node --test` → 10 pruebas en verde.

**1 · Oferta y demanda**

- [ ] Con los valores por defecto, los KPI muestran P* = $24.00 y Q* = 48.0. Con b = 2, d = 2: $30.00 y 60.0.
- [ ] Con t > 0 aparece la oferta original en guiones claros; el KPI de recaudo y PIE no es cero; «Productor recibe $Pp».
- [ ] Con P̄ < P* aparece la línea roja horizontal y la escasez. Con P̄ ≥ P*, el KPI dice «El tope no es efectivo».
- [ ] La telaraña anima 30 períodos y la etiqueta cambia de color según d/b.

**2 · Interés compuesto**

- [ ] Con los valores por defecto: VF $22,196.40, TEA 8.30 %, valor real $14,995.09, alternativa B $18,193.97.
- [ ] Al cambiar n se actualizan la TEA y la curva. Con r = 0 no aparecen NaN ni ∞, salvo «años para duplicar = ∞».
- [ ] La frase de decisión nombra la alternativa ganadora y la diferencia en $. Advierte si π ≥ TEA.

**3 · EOQ**

- [ ] Con D = 1200, S = 50, H = 2: Q* 244.9, 4.90 pedidos al año, 73.5 días, $489.90.
- [ ] Mover Q muestra el círculo rojo sobre la curva total y el sobrecosto (%). «Usar Q*» lo devuelve al óptimo y muestra «Estás en el óptimo».
- [ ] El diente de sierra se dibuja con Q* y con Q.

**4 · Punto de reorden**

- [ ] Con los valores por defecto y semilla 42: SS 16.4, ROP 96.4, 12 pedidos, 50 u perdidas, fill rate 97.9 %.
- [ ] Las líneas de ROP y SS son horizontales y hay marcas de pedido y de faltante. La animación revela un día por tick. Los cuatro estados del runner se comportan como indica la sección 7.3.

**5 · Sistemas de revisión**

- [ ] Ambas políticas usan la misma demanda: la tabla muestra S 247.3, SS 27.3 vs 16.4, y 17 vs 12 pedidos (semilla 42, valores por defecto).
- [ ] Aparecen líneas verticales en cada día múltiplo de T. La gráfica de pedidos muestra lotes fijos frente a variables.

**6 · Efecto látigo**

- [ ] Con semilla 42 y valores por defecto, los ratios son crecientes (×3.35, ×13.13, ×47.54, ×136.94) y la cota es 2.12.
- [ ] Activar «Compartir información» reduce el ratio de la fábrica (×21.76).
- [ ] Las barras usan escala logarítmica con marcas de cota, y el diagrama de cadena muestra los ratios.

**7 · Beer Game**

- [ ] En automático, con semilla 42 y Poisson λ = 4: el KPI de amplificación muestra ×4.29 y el costo total $961.50. Con escalón: $2,673.50.
- [ ] En modo jugador, la corrida se pausa cada semana con el panel «Tu turno»; «Enviar pedido» avanza una semana usando el valor escrito. El nodo del jugador lleva la etiqueta «TÚ».
- [ ] La animación SVG mueve envíos (→) y pedidos (←) entre nodos. Los inventarios negativos se ven en rojo como «cajas pendientes».

**8 · Colas**

- [ ] Con λ = 4 y μ = 5: ρ 80 %, L 4.00, Lq 3.20, W 60 min, Wq 48 min, P(esperar) 80 %.
- [ ] Con λ ≥ c·μ aparece la alerta `role="alert"` y los valores teóricos muestran ∞. La simulación sigue corriendo.
- [ ] La fila animada muestra hasta 14 clientes («+n» si hay más) y los servidores en estado ocupado o libre. La curva L(ρ) marca el punto actual.
- [ ] Con μ = (6, 4.5, 5), el cuello de botella es «Proceso» y el throughput es min(λ, 4.5).

---

## 11. Decisiones de diseño a respetar

- **Una sola página shell.** Header oscuro (marca, ruta en monoespaciada, semilla, Guardar, Copiar enlace), navegación lateral numerada 01–08 y contenido.
- **Orden de cada sección:** primero parámetros, luego resultados y al final la explicación. Las tarjetas son blancas con borde `--line` y radio de 14 px. No hay degradados ni sombras salvo en hover y en la barra móvil.
- **Etiqueta de categoría** (Mercados, Finanzas, Inventarios, Cadena de suministro, Servicios) en `--accent-soft` / `--accent-ink`.
- **Fórmulas:** se muestran con KaTeX y la cadena TeX va en un `<code>` gris debajo. Es una ayuda docente: se puede copiar a apuntes.
- **Textos en español neutro.** Formato numérico `es-MX` (coma de miles, punto decimal) y moneda `$`.
