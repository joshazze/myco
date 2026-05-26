import { h, icon } from './ui.js';

const tabs = [
  { path: '/', label: 'Hoje', icon: 'home' },
  { path: '/pokedex', label: 'Pokédex', icon: 'pot' },
  { path: '/setores', label: 'Setores', icon: 'sector' },
  { path: '/composto', label: 'Composto', icon: 'compost' },
  { path: '/settings', label: 'Ajustes', icon: 'settings' },
];

const titles = {
  '/': 'Jardim',
  '/pokedex': 'Pokédex',
  '/setores': 'Setores',
  '/composto': 'Compostagem',
  '/backup': 'Backup',
  '/settings': 'Ajustes',
};

function matchTab(path) {
  if (path === '/') return '/';
  if (path.startsWith('/pokedex')) return '/pokedex';
  if (path.startsWith('/setores')) return '/setores';
  if (path.startsWith('/composto')) return '/composto';
  if (path.startsWith('/settings') || path.startsWith('/backup')) return '/settings';
  return null;
}

export function topBar(titleOverride) {
  const path = (location.hash || '#/').slice(1) || '/';
  const base = matchTab(path) || path;
  return h('header', { class: 'topbar' },
    h('div', { class: 'title' }, titleOverride || titles[base] || 'myco'),
  );
}

export function bottomNav() {
  const path = (location.hash || '#/').slice(1) || '/';
  const active = matchTab(path);
  const nav = h('nav', { class: 'bottomnav' });
  for (const t of tabs) {
    const a = h('a', {
      href: '#' + t.path,
      class: active === t.path ? 'active' : '',
    }, icon(t.icon), h('span', null, t.label));
    nav.appendChild(a);
  }
  return nav;
}
