// Router por hash: #/<ruta>?k=v. Monta la vista en <main id="view">.
import { parseHash, parseSeed, routeState, cancelUrl } from './store.js';
import { renderMath } from './ui/math.js';
import home from './views/home.js';
import supplyDemand from './views/supplyDemand.js';
import compoundInterest from './views/compoundInterest.js';
import eoq from './views/eoq.js';
import reorderPoint from './views/reorderPoint.js';
import reviewSystems from './views/reviewSystems.js';
import bullwhip from './views/bullwhip.js';
import beerGame from './views/beerGame.js';
import queues from './views/queues.js';

export const VIEWS = [home, supplyDemand, compoundInterest, eoq, reorderPoint, reviewSystems, bullwhip, beerGame, queues];
export const ROUTES = Object.fromEntries(VIEWS.map((v) => [v.route, v]));
export const APP_NAME = 'SimulacionEcoWeb';

let viewEl = null;
let mounted = null;
let first = true;

export function startRouter(el) {
  viewEl = el;
  window.addEventListener('hashchange', render);
  render();
}

function render() {
  const { path, query } = parseHash(location.hash);
  const view = ROUTES[path];
  if (!view) {
    location.replace('#/');
    if (!mounted) mount(ROUTES[''], {}, '');
    return;
  }
  mount(view, query, path);
}

function mount(view, query, path) {
  const Alpine = window.Alpine;
  const app = Alpine.store('app');
  cancelUrl();
  if (mounted && viewEl.firstElementChild) Alpine.destroyTree(viewEl.firstElementChild);
  routeState.path = path;
  routeState.query = query;
  app.route = path;
  app.navOpen = false;
  app.seed = parseSeed(query.seed);
  viewEl.innerHTML = view.template();
  mounted = view;
  document.title = path ? `${view.title} · ${APP_NAME}` : `${APP_NAME} · Simulaciones económicas interactivas`;
  if (viewEl.firstElementChild) Alpine.initTree(viewEl.firstElementChild);
  renderMath(viewEl);
  if (!first) {
    window.scrollTo(0, 0);
    viewEl.querySelector('h1')?.focus();
  }
  first = false;
}
