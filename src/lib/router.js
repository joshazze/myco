const routes = new Map();
const dynamicRoutes = [];
let mountEl = null;
let notFound = null;
let beforeEach = null;

export function defineRoute(path, render) {
  if (path.includes(':')) {
    const parts = path.split('/').filter(Boolean);
    const regex = new RegExp(
      '^/' + parts.map((p) => (p.startsWith(':') ? '([^/]+)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '$',
    );
    const keys = parts.filter((p) => p.startsWith(':')).map((p) => p.slice(1));
    dynamicRoutes.push({ regex, keys, render });
  } else {
    routes.set(path, render);
  }
}

export function setNotFound(fn) {
  notFound = fn;
}

export function setBeforeEach(fn) {
  beforeEach = fn;
}

export function navigate(path) {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function start(el) {
  mountEl = el;
  window.addEventListener('hashchange', resolve);
  resolve();
}

export function rerender() {
  resolve();
}

export function currentPath() {
  return currentFullPath().split('?')[0];
}

export function currentQuery() {
  const q = currentFullPath().split('?')[1] || '';
  return new URLSearchParams(q);
}

function currentFullPath() {
  const h = location.hash || '#/';
  return h.startsWith('#') ? h.slice(1) : h;
}

function matchDynamic(path) {
  for (const r of dynamicRoutes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { render: r.render, params };
    }
  }
  return null;
}

async function resolve() {
  const path = currentPath() || '/';
  const query = currentQuery();
  if (beforeEach) {
    const redirected = await beforeEach(path);
    if (redirected) return;
  }
  let handler = routes.get(path);
  let params = { query };
  if (!handler) {
    const dyn = matchDynamic(path);
    if (dyn) { handler = dyn.render; params = { ...dyn.params, query }; }
  }
  if (!handler) handler = notFound;
  if (!handler) return;
  mountEl.innerHTML = '';
  const node = await handler(params);
  if (node) mountEl.appendChild(node);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
