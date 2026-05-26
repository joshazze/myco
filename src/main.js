import './styles.css';
import { defineRoute, setNotFound, setBeforeEach, start, navigate } from './lib/router.js';
import { hasData, setSession } from './lib/state.js';
import { loadEncryptedData } from './lib/storage.js';
import { hasAuth, tryAutoUnlock, getKey, getMeta } from './lib/auth.js';
import { h } from './components/ui.js';
import { topBar, bottomNav } from './components/nav.js';
import { renderSignup } from './views/signup.js';
import { renderUnlock } from './views/unlock.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSectors } from './views/sectors.js';
import { renderSectorDetail } from './views/sector-detail.js';
import { renderPots } from './views/pots.js';
import { renderPotDetail } from './views/pot-detail.js';
import { renderCompost } from './views/compost.js';
import { renderCompostDetail } from './views/compost-detail.js';
import { renderBackup } from './views/backup.js';
import { renderSettings } from './views/settings.js';

const app = document.getElementById('app');

function shell(view) {
  return h('div', { class: 'shell' },
    topBar(),
    h('main', { class: 'content' }, view),
    bottomNav(),
  );
}

defineRoute('/signup', () => renderSignup());
defineRoute('/unlock', () => renderUnlock());
defineRoute('/', async () => shell(await renderDashboard()));
defineRoute('/pokedex', async () => shell(await renderPots()));
defineRoute('/pokedex/:id', async (params) => shell(await renderPotDetail(params)));
defineRoute('/setores', async () => shell(await renderSectors()));
defineRoute('/setores/:id', async (params) => shell(await renderSectorDetail(params)));
defineRoute('/composto', async () => shell(await renderCompost()));
defineRoute('/composto/:n', async (params) => shell(await renderCompostDetail(params)));
defineRoute('/backup', async () => shell(await renderBackup()));
defineRoute('/settings', async () => shell(await renderSettings()));

setNotFound(async () => shell(h('div', { class: 'empty' },
  h('strong', null, 'Rota não encontrada'),
  h('a', { href: '#/' }, 'Voltar pro início'),
)));

setBeforeEach(async (path) => {
  // Strip query string for matching auth gates
  const cleanPath = path.split('?')[0];

  if (!hasAuth()) {
    if (cleanPath !== '/signup') {
      navigate('/signup');
      return true;
    }
    return false;
  }
  if (cleanPath === '/signup') {
    navigate('/');
    return true;
  }

  if (!getKey()) {
    const m = await tryAutoUnlock();
    if (!m) {
      if (cleanPath !== '/unlock') {
        navigate('/unlock');
        return true;
      }
      return false;
    }
  }
  if (cleanPath === '/unlock') {
    navigate('/');
    return true;
  }

  if (!hasData()) {
    const data = await loadEncryptedData();
    setSession(data, getMeta());
  }

  return false;
});

start(app);

// PWA: register service worker only in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
