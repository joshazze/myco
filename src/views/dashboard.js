import { h, icon, emptyState } from '../components/ui.js';
import {
  getState,
  selectSectorStatus,
  selectActiveLot,
  FERT_TYPES,
} from '../lib/state.js';
import { fmtDaysAgo, daysBetween } from '../lib/format.js';
import { isBackupNagDue, lastBackupSummary } from '../lib/backup.js';

const FERT_TYPES_ORDER = ['liquid', 'solid', 'bicarbonate'];

export async function renderDashboard() {
  const { data } = getState();
  const container = h('div');

  if (!data) {
    container.appendChild(emptyState('Carregando…', ''));
    return container;
  }

  // First-time: render apenas o onboarding (sem stats vazios em cima)
  if (data.pots.length === 0 && data.sectors.length === 0 && data.compostLots.length === 0) {
    container.appendChild(onboardingCard());
    updateBadge(0);
    return container;
  }

  // Header normal
  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Seu jardim'),
    h('span', { class: 'pill', title: 'Dados ficam só neste celular, cifrados.' },
      h('span', { class: 'pill-dot' }), 'cifrado'),
  ));

  container.appendChild(h('div', { class: 'stat-grid' },
    statTile('Vasos', data.pots.length, 'pot', '#/pokedex'),
    statTile('Setores', data.sectors.length, 'sector', '#/setores'),
    statTile('Adubações', data.fertilizations.length, 'droplet', null),
    statTile('Lotes composto', data.compostLots.length, 'compost', '#/composto'),
  ));

  // Backup nag
  if (isBackupNagDue(data)) {
    container.appendChild(h('div', { class: 'alert-card alert-warm' },
      h('div', { class: 'alert-icon' }, icon('warning')),
      h('div', { class: 'alert-body' },
        h('strong', null, 'Faça um backup'),
        h('div', { class: 'small muted' }, lastBackupSummary(data)),
      ),
      h('a', { class: 'btn btn-warm btn-sm', href: '#/backup' }, icon('download'), 'Salvar agora'),
    ));
  }

  // Overdue sectors
  const overdueAlerts = [];
  let overdueCount = 0;
  for (const s of data.sectors) {
    const status = selectSectorStatus(s.id);
    if (!status) continue;
    const overdue = FERT_TYPES_ORDER
      .map((t) => ({ t, info: status[t] }))
      .filter((x) => x.info.overdue);
    if (overdue.length) {
      overdueCount += overdue.length;
      overdueAlerts.push({ sector: s, overdue });
    }
  }

  if (overdueAlerts.length) {
    container.appendChild(h('h3', { class: 'subhead', style: { marginTop: '18px' } },
      `Setores precisando de atenção · ${overdueCount}`));
    const list = h('div');
    for (const alert of overdueAlerts) list.appendChild(overdueRow(alert));
    container.appendChild(list);
  }

  // Active compost lots
  const readyLots = [];
  const maturingLots = [];
  for (const box of [1, 2, 3, 4]) {
    const active = selectActiveLot(box);
    if (!active) continue;
    if (active.completedISO) readyLots.push(active);
    else maturingLots.push(active);
  }

  if (readyLots.length || maturingLots.length) {
    container.appendChild(h('h3', { class: 'subhead', style: { marginTop: '18px' } },
      'Compostagem'));
    const grid = h('div', { class: 'compost-mini-grid' });
    for (const lot of readyLots) grid.appendChild(activeLotCard(lot, 'ready'));
    for (const lot of maturingLots) grid.appendChild(activeLotCard(lot, 'maturing'));
    container.appendChild(grid);
  }

  if (!overdueAlerts.length && !readyLots.length && !isBackupNagDue(data)) {
    container.appendChild(h('div', { class: 'card', style: { marginTop: '18px', textAlign: 'center' } },
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px' } },
        h('div', { style: { color: 'var(--accent)' } }, icon('sparkle')),
        h('strong', null, 'Tudo em dia'),
      ),
      h('p', { class: 'small dim', style: { margin: '6px 0 0' } },
        'Nenhum setor atrasado · nenhum lote esperando.'),
    ));
  }

  updateBadge(overdueCount + readyLots.length);

  return container;
}

function onboardingCard() {
  const card = h('div', { class: 'onboard' });
  card.appendChild(h('div', { class: 'onboard-icon' }, icon('leaf')));
  card.appendChild(h('h2', null, 'Seu jardim começa aqui'));
  card.appendChild(h('p', null,
    'Antes de cadastrar as plantas, divida sua casa em ',
    h('strong', null, 'setores'),
    ' (ex: frente, fundos, varanda). Depois é só plantar.',
  ));

  const steps = h('div', { class: 'steps' },
    h('div', { class: 'onboard-step' },
      h('div', { class: 'num' }, '1'),
      h('div', null,
        h('strong', null, 'Crie um setor'),
        h('div', { class: 'small' }, 'um espaço do seu quintal/casa'),
      ),
    ),
    h('div', { class: 'onboard-step' },
      h('div', { class: 'num' }, '2'),
      h('div', null,
        h('strong', null, 'Cadastre as plantas'),
        h('div', { class: 'small' }, 'na Pokédex, com foto'),
      ),
    ),
    h('div', { class: 'onboard-step' },
      h('div', { class: 'num' }, '3'),
      h('div', null,
        h('strong', null, 'Marque cada adubação'),
        h('div', { class: 'small' }, 'o app avisa quando atrasar'),
      ),
    ),
  );
  card.appendChild(steps);

  card.appendChild(h('a', {
    class: 'btn btn-primary btn-block',
    href: '#/setores',
  }, icon('plus'), 'Criar meu primeiro setor'));

  return card;
}

function statTile(label, value, ico, href) {
  return h(href ? 'a' : 'div', {
    class: 'stat',
    href: href || undefined,
    'aria-label': href ? `${label}: ${value} — tocar para abrir` : undefined,
  },
    h('div', { class: 'stat-icon' }, icon(ico)),
    h('div', { class: 'label' }, label),
    h('div', { class: 'value accent tabular' }, value),
  );
}

function overdueRow({ sector, overdue }) {
  return h('a', { class: 'card alert-row', href: `#/setores/${sector.id}` },
    h('div', { class: 'alert-icon danger' }, icon('warning')),
    h('div', { class: 'alert-body' },
      h('div', { class: 'alert-title' }, sector.name),
      h('div', { class: 'small dim mono' },
        overdue.map(({ t, info }) =>
          `${FERT_TYPES[t].shortLabel} +${info.daysSince - sector.intervals[t]}d`,
        ).join(' · '),
      ),
    ),
    h('span', { class: 'pill danger small' }, `${overdue.length}`),
  );
}

function activeLotCard(lot, phase) {
  const today = new Date().toISOString();
  return h('a', { class: `card compost-mini-card ${phase}`, href: `#/composto/${lot.boxNumber}` },
    h('div', { class: 'compost-mini-head' },
      h('div', { class: 'mono small dim' }, `Caixa ${lot.boxNumber}`),
      h('span', { class: `pill ${phase === 'ready' ? 'warm' : ''} small` },
        h('span', { class: 'pill-dot' }),
        phase === 'ready' ? 'pronta' : 'maturando',
      ),
    ),
    h('div', { class: 'mono small', style: { marginTop: '6px' } },
      phase === 'ready'
        ? `pronta há ${daysBetween(lot.completedISO, today)}d`
        : `${daysBetween(lot.startedISO, today)}d desde início`,
    ),
  );
}

function updateBadge(count) {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) navigator.setAppBadge(count);
      else navigator.clearAppBadge();
    } catch { /* ignored */ }
  }
}
