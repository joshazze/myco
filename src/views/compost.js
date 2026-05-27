import { h, icon } from '../components/ui.js';
import {
  getState,
  selectActiveLot,
  selectLotsForBox,
  selectLastHarvestForBox,
  HARVEST_INTERVAL_DAYS,
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

  const lastHarvest = selectLastHarvestForBox(n);
  let harvestLine = null;
  if (lastHarvest) {
    const daysSince = daysBetween(lastHarvest.dateISO, new Date().toISOString());
    const overdue = daysSince > HARVEST_INTERVAL_DAYS;
    harvestLine = h('div', { class: 'compost-box-harvest row small mono', style: { gap: '6px', flexWrap: 'wrap' } },
      h('span', { class: 'dim' }, 'chorume:'),
      h('span', null, `${shortDate(lastHarvest.dateISO)}${lastHarvest.quantity ? ` · ${lastHarvest.quantity}` : ''}`),
      overdue
        ? h('span', { class: 'pill warm' }, h('span', { class: 'pill-dot' }), `atrasado ${daysSince - HARVEST_INTERVAL_DAYS}d`)
        : null,
    );
  } else if (active) {
    harvestLine = h('div', { class: 'small dim mono' }, 'sem extração de chorume');
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
    harvestLine,
    active && h('div', { class: 'compost-box-cta row small', style: { marginTop: '10px' } },
      h('span', { class: 'mono dim' }, fmtDateRelative(active.startedISO)),
    ),
  );
}

function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
