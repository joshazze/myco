import { h, icon, emptyState } from '../components/ui.js';
import { confirm } from '../components/modal.js';
import {
  getState,
  selectPotsInSector,
  selectFertsForSector,
  selectSectorStatus,
  deleteSector,
  FERT_TYPES,
} from '../lib/state.js';
import { rerender, navigate } from '../lib/router.js';
import { openEditSectorModal } from './sectors.js';
import { openBulkFertilizeModal } from './fert-modal.js';
import { fmtDateRelative, fmtDaysAgo } from '../lib/format.js';

export async function renderSectorDetail({ id }) {
  const { data } = getState();
  const sector = data.sectors.find((s) => s.id === id);
  const container = h('div');

  if (!sector) {
    container.appendChild(emptyState('Setor não encontrado', h('a', { href: '#/setores' }, 'Voltar')));
    return container;
  }

  const pots = selectPotsInSector(sector.id);
  const ferts = selectFertsForSector(sector.id);
  const status = selectSectorStatus(sector.id);

  container.appendChild(h('div', { class: 'back-link' },
    h('a', { href: '#/setores', class: 'row dim small' }, icon('arrowLeft'), 'Setores'),
  ));

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, sector.name),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn btn-sm btn-ghost',
        onClick: () => openEditSectorModal(sector),
      }, icon('edit'), 'Editar'),
      h('button', {
        class: 'btn btn-sm btn-ghost',
        onClick: async () => {
          const ok = await confirm(
            `Apagar setor "${sector.name}"? Os vasos ficam sem setor (mas não são apagados).`,
            { confirmLabel: 'Apagar', variant: 'btn-danger' },
          );
          if (ok) { await deleteSector(sector.id); navigate('/setores'); }
        },
      }, icon('trash')),
    ),
  ));

  if (sector.description) {
    container.appendChild(h('p', { class: 'muted', style: { margin: '0 0 18px' } }, sector.description));
  }

  // Status cards
  const statusGrid = h('div', { class: 'stat-grid' });
  for (const t of ['liquid', 'solid', 'bicarbonate']) {
    const s = status[t];
    const overdue = s.overdue;
    const card = h('div', { class: `stat ${overdue ? 'stat-warn' : ''}` },
      h('div', { class: 'stat-icon' }, icon(FERT_TYPES[t].icon)),
      h('div', { class: 'label' }, FERT_TYPES[t].label),
      h('div', { class: `value ${overdue ? 'danger' : 'accent'}` },
        s.lastISO == null ? '—' : `${s.daysSince}d`,
      ),
      h('div', { class: 'sub' },
        s.lastISO == null
          ? `intervalo: ${sector.intervals[t]}d`
          : overdue
            ? `+${s.daysSince - sector.intervals[t]}d atrasado · alvo ${sector.intervals[t]}d`
            : `em ${s.dueInDays}d (intervalo ${sector.intervals[t]}d)`,
      ),
    );
    statusGrid.appendChild(card);
  }
  container.appendChild(statusGrid);

  container.appendChild(h('div', { class: 'row', style: { margin: '6px 0 22px', gap: '8px' } },
    h('button', {
      class: 'btn btn-primary',
      onClick: () => openBulkFertilizeModal(sector),
    }, icon('droplet'), 'Adubar bloco inteiro'),
    pots.length > 0 && h('a', {
      class: 'btn btn-ghost',
      href: `#/pokedex?setor=${sector.id}`,
    }, icon('pot'), 'Ver vasos'),
  ));

  // Vasos do setor
  container.appendChild(h('h3', { class: 'subhead' }, `Vasos · ${pots.length}`));
  if (!pots.length) {
    container.appendChild(emptyState(
      'Nenhum vaso aqui ainda',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } },
        h('a', { href: '#/pokedex' }, 'Vá pra Pokédex'), ' pra criar.'),
    ));
  } else {
    const grid = h('div', { class: 'pot-grid' });
    for (const p of pots) grid.appendChild(potMiniCard(p));
    container.appendChild(grid);
  }

  // Histórico recente do setor
  container.appendChild(h('h3', { class: 'subhead', style: { marginTop: '22px' } }, 'Histórico recente'));
  if (!ferts.length) {
    container.appendChild(emptyState('Sem adubações registradas neste setor ainda.'));
  } else {
    const list = h('div');
    for (const f of ferts.slice(0, 15)) {
      const pot = data.pots.find((p) => p.id === f.potId);
      list.appendChild(fertRow(f, pot));
    }
    if (ferts.length > 15) {
      list.appendChild(h('div', { class: 'small dim center', style: { marginTop: '8px' } },
        `+ ${ferts.length - 15} entradas anteriores`));
    }
    container.appendChild(list);
  }

  return container;
}

function potMiniCard(p) {
  return h('a', { class: 'pot-mini', href: `#/pokedex/${p.id}` },
    p.photo
      ? h('img', { src: p.photo, alt: p.name, class: 'pot-mini-photo' })
      : h('div', { class: 'pot-mini-photo placeholder' }, icon('pot')),
    h('div', { class: 'pot-mini-meta' },
      h('div', { class: 'pot-id mono' }, p.displayId),
      h('div', { class: 'pot-mini-name' }, p.name),
    ),
  );
}

function fertRow(f, pot) {
  const type = FERT_TYPES[f.type];
  return h('div', { class: 'fert-row' },
    h('div', { class: 'fert-row-icon' }, icon(type?.icon || 'droplet')),
    h('div', { class: 'fert-row-body' },
      h('div', { class: 'fert-row-title' },
        h('strong', null, type?.label || f.type),
        pot ? h('span', { class: 'mono dim small', style: { marginLeft: '8px' } }, `${pot.displayId} ${pot.name}`) : null,
      ),
      h('div', { class: 'small dim' },
        fmtDateRelative(f.dateISO),
        f.dose ? ` · ${f.dose}` : '',
        f.notes ? ` · ${f.notes}` : '',
      ),
    ),
    h('div', { class: 'fert-row-ago mono small dim' }, fmtDaysAgo(f.dateISO) || ''),
  );
}
