# SimulacionEcoWeb

Laboratorio web estático y responsivo con **8 simulaciones económicas interactivas**: oferta y demanda, interés compuesto, EOQ, punto de reorden, sistemas de revisión, efecto látigo, Beer Game y teoría de colas.

- HTML, CSS y JavaScript ES2022 **sin compilación**: lo que está en `public/` es exactamente lo que se sirve.
- Alpine.js 3.17.5, Chart.js 4.5.1 (UMD) y KaTeX 0.19.1 alojados en `public/vendor/`; fuentes Inter, Space Grotesk y JetBrains Mono (OFL) en `public/fonts/`. Sin peticiones a dominios externos.
- Rutas por hash (`#/eoq?D=1200&S=50&H=2&seed=42`), estado en la URL y escenarios guardados en `localStorage`.
- Modelos puros y reproducibles en `public/js/sims/` (semilla `mulberry32`), probados con `node --test`.

El contrato completo de diseño está en [`docs/README-handoff.md`](docs/README-handoff.md).

## Rutas

| Ruta | Simulación |
|---|---|
| `#/` | Inicio |
| `#/oferta-demanda` | Oferta y demanda, impuesto, precio máximo y telaraña |
| `#/interes-compuesto` | Interés compuesto y decisiones financieras |
| `#/eoq` | Cantidad económica de pedido |
| `#/punto-reorden` | Punto de reorden con demanda variable |
| `#/sistemas-revision` | Revisión continua vs. periódica |
| `#/efecto-latigo` | Efecto látigo |
| `#/beer-game` | Beer Game simplificado (automático o jugando un rol) |
| `#/colas` | Colas M/M/1, M/M/c y cuello de botella |

## Desarrollo local

Requiere Node 24 (ver `.node-version`).

```bash
npm test                      # 10 pruebas de los modelos (node --test)
npx serve public              # o: python3 -m http.server -d public 8080
```

## Estructura

```
public/
  index.html  404.html  favicon.svg
  css/   tokens.css  base.css  components.css
  js/    app.js  router.js  store.js
         ui/     charts.js  math.js  runner.js  components.js
         views/  home.js + una vista por simulación
         sims/   rng.js + un módulo puro por simulación (no tocan el DOM)
  vendor/  alpine-3.17.5.min.js  chart-4.5.1.umd.min.js  katex-0.19.1/
  fonts/   woff2 (OFL)
tests/sims.test.js
```

## Despliegue en Cloudflare Workers (solo assets)

`wrangler.jsonc` publica `./public` sin script. Con Workers Builds conectado a este repositorio: *Build command* vacío y *Deploy command* `npx wrangler deploy`. A mano:

```bash
npm ci && npx wrangler login && npx wrangler deploy
```

Alternativa: Cloudflare Pages o GitHub Pages con `public/` como directorio de salida (no hay paso de build).
