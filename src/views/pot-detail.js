import { h, icon, emptyState } from '../components/ui.js';
import { openModal, confirm } from '../components/modal.js';
import {
  getState,
  updatePot,
  deletePot,
  deleteFertilization,
  selectFertsForPot,
  FERT_TYPES,
} from '../lib/state.js';
import { rerender, navigate } from '../lib/router.js';
import { toDateLocal, fromDateLocal, fmtDateRelative, fmtDaysAgo, fmtDateFull } from '../lib/format.js';
import { openFertilizePotModal } from './fert-modal.js';
import { buildPhotoField } from './pots.js';

export async function renderPotDetail({ id }) {
  const { data } = getState();
  const pot = data.pots.find((p) => p.id === id);
  const container = h('div');

  if (!pot) {
    container.appendChild(emptyState('Planta não encontrada',
      h('a', { href: '#/pokedex' }, 'Voltar pra Pokédex')));
    return container;
  }

  const sector = data.sectors.find((s) => s.id === pot.sectorId);
  const ferts = selectFertsForPot(pot.id);

  container.appendChild(h('div', { class: 'back-link' },
    h('a', { href: '#/pokedex', class: 'row dim small' }, icon('arrowLeft'), 'Pokédex'),
  ));

  // Hero
  const hero = h('div', { class: 'pot-hero' },
    pot.photo
      ? h('img', { src: pot.photo, alt: pot.name, class: 'pot-hero-photo' })
      : h('div', { class: 'pot-hero-photo placeholder' }, icon('pot')),
    h('div', { class: 'pot-hero-meta' },
      h('div', { class: 'pot-id mono' }, pot.displayId),
      h('h2', { class: 'pot-hero-name' }, pot.name),
      pot.species ? h('div', { class: 'pot-hero-species italic muted' }, pot.species) : null,
      h('div', { class: 'pot-hero-info small dim' },
        sector ? h('a', { href: `#/setores/${sector.id}` }, sector.name) : 'sem setor',
        pot.plantedISO ? ' · plantio ' + fmtDateFull(pot.plantedISO) : null,
      ),
    ),
  );
  container.appendChild(hero);

  if (pot.description) {
    container.appendChild(h('p', { class: 'pot-description muted' }, pot.description));
  }

  // Actions
  container.appendChild(h('div', { class: 'pot-actions row', style: { margin: '14px 0 22px' } },
    h('button', {
      class: 'btn btn-primary',
      onClick: () => openFertilizePotModal(pot),
    }, icon('droplet'), 'Adubar esta planta'),
    h('button', {
      class: 'btn btn-ghost',
      'aria-label': 'Editar planta',
      onClick: () => openEditPotModal(pot),
    }, icon('edit'), 'Editar'),
    h('button', {
      class: 'btn btn-ghost',
      'aria-label': 'Apagar planta',
      title: 'Apagar planta',
      onClick: async () => {
        const ok = await confirm(
          `Apagar ${pot.displayId} ${pot.name}? O histórico de adubação também vai junto.`,
          { confirmLabel: 'Apagar', variant: 'btn-danger' },
        );
        if (ok) { await deletePot(pot.id); navigate('/pokedex'); }
      },
    }, icon('trash')),
  ));

  // Histórico
  container.appendChild(h('h3', { class: 'subhead' }, `Histórico · ${ferts.length}`));
  if (!ferts.length) {
    container.appendChild(emptyState('Sem adubações registradas'));
  } else {
    const list = h('div');
    for (const f of ferts) list.appendChild(fertEntry(f, async () => {
      const ok = await confirm('Apagar esta adubação do histórico?', {
        confirmLabel: 'Apagar', variant: 'btn-danger',
      });
      if (ok) { await deleteFertilization(f.id); rerender(); }
    }));
    container.appendChild(list);
  }

  return container;
}

function fertEntry(f, onDelete) {
  const type = FERT_TYPES[f.type];
  return h('div', { class: 'fert-entry' },
    h('div', { class: 'fert-entry-icon' }, icon(type?.icon || 'droplet')),
    h('div', { class: 'fert-entry-body' },
      h('div', { class: 'fert-entry-title' },
        h('strong', null, type?.label || f.type),
        h('span', { class: 'mono dim small', style: { marginLeft: '8px' } }, fmtDaysAgo(f.dateISO)),
      ),
      h('div', { class: 'small dim' }, fmtDateRelative(f.dateISO), f.dose ? ` · ${f.dose}` : ''),
      f.notes ? h('div', { class: 'small', style: { marginTop: '4px' } }, f.notes) : null,
      f.photo ? h('img', { src: f.photo, class: 'fert-entry-photo', alt: 'foto' }) : null,
    ),
    h('button', {
      class: 'btn btn-sm btn-ghost',
      'aria-label': 'Apagar esta adubação',
      onClick: onDelete,
    }, icon('trash')),
  );
}

async function openEditPotModal(pot) {
  const { data } = getState();
  const name = h('input', { type: 'text', enterkeyhint: 'next', value: pot.name, required: true });
  const species = h('input', { type: 'text', enterkeyhint: 'next', value: pot.species || '' });
  const planted = h('input', { type: 'date', value: toDateLocal(pot.plantedISO) });
  const desc = h('textarea', null);
  desc.value = pot.description || '';

  const sectorSelect = h('select', null,
    h('option', { value: '' }, '— sem setor —'),
    ...data.sectors.map((s) => h('option', { value: s.id }, s.name)),
  );
  sectorSelect.value = pot.sectorId || '';

  const photo = buildPhotoField(pot.photo);

  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Nome'), name),
    h('div', { class: 'field' }, h('label', null, 'Espécie (opcional)'), species),
    h('div', { class: 'field' }, h('label', null, 'Plantio/Aquisição'), planted),
    h('div', { class: 'field' }, h('label', null, 'Setor'), sectorSelect),
    h('div', { class: 'field' }, h('label', null, 'Notas'), desc),
    photo.fieldEl,
  );

  const ok = await openModal({
    title: `Editar ${pot.displayId}`,
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Salvar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          if (!name.value.trim()) { name.focus(); return false; }
          await updatePot(pot.id, {
            name: name.value,
            species: species.value,
            plantedISO: fromDateLocal(planted.value),
            description: desc.value,
            sectorId: sectorSelect.value || null,
            photo: photo.value,
          });
          close(true);
        },
      },
    ],
  });
  if (ok) rerender();
}
