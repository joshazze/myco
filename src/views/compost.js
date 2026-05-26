import { h, icon } from '../components/ui.js';
import {
  getState,
  selectActiveLot,
  selectLotsForBox,
} from '../lib/state.js';
import { fmtDaysAgo, daysBetween, fmtDateRelative } from '../lib/format.js';

const BOXES = [1, 2, 3, 4];

export async function renderCompost() {
  const container = h('div');

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Compostagem'),
    h('span', { class: 'small dim' }, '4 caixas · histórico de lotes'),
  ));

  const grid = h('div', { class: 'compost-grid' });
  for (const n of BOXES) grid.appendChild(boxCard(n));
  container.appendChild(grid);

  return container;
}

function boxCard(n) {
  const active = selectActiveLot(n);
  const lots = selectLotsForBox(n);
  const total = lots.length;
  const finished = lots.filter((l) => l.emptiedISO).length;

  let stateLabel = 'vazia';
  let statePill = 'pill';
  let ageLine = h('div', { class: 'small dim mono' }, 'pronta pra iniciar lote');
  if (active) {
    if (active.completedISO) {
      stateLabel = 'pronta pra esvaziar';
      statePill = 'pill warm';
      ageLine = h('div', { class: 'small mono' },
        `completa há ${daysBetween(active.completedISO, new Date().toISOString())}d`);
    } else {
      stateLabel = 'em maturação';
      statePill = 'pill';
      ageLine = h('div', { class: 'small mono' },
        `iniciada há ${daysBetween(active.startedISO, new Date().toISOString())}d`);
    }
  }

  return h('a', { class: 'card compost-box-card', href: `#/composto/${n}` },
    h('div', { class: 'compost-box-head' },
      h('div', { class: 'compost-box-num mono' }, `Caixa ${n}`),
      h('span', { class: statePill }, h('span', { class: 'pill-dot' }), stateLabel),
    ),
    ageLine,
    h('div', { class: 'compost-box-stats small dim mono' },
      `${total} lote${total === 1 ? '' : 's'} · ${finished} concluído${finished === 1 ? '' : 's'}`,
    ),
    active && h('div', { class: 'compost-box-cta row small', style: { marginTop: '10px' } },
      h('span', { class: 'mono dim' }, fmtDateRelative(active.startedISO)),
    ),
  );
}
