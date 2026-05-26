import { h, icon, emptyState } from '../components/ui.js';
import { openModal, confirm } from '../components/modal.js';
import {
  getState,
  addSector,
  updateSector,
  deleteSector,
  selectPotsInSector,
  selectSectorStatus,
  FERT_TYPES,
} from '../lib/state.js';
import { rerender } from '../lib/router.js';
import { openBulkFertilizeModal } from './fert-modal.js';

export async function renderSectors() {
  const { data } = getState();
  const container = h('div');

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Setores'),
    h('button', { class: 'btn btn-primary btn-sm', onClick: openCreateSectorModal },
      icon('plus'), 'Novo setor',
    ),
  ));

  if (!data.sectors.length) {
    container.appendChild(emptyState(
      'Nenhum setor ainda',
      h('p', { style: { margin: '6px 0 14px' } },
        'Crie um setor (ex: "frente", "fundos", "varanda") pra começar a organizar suas plantas.'),
      h('button', {
        class: 'btn btn-primary',
        onClick: openCreateSectorModal,
      }, icon('plus'), 'Criar primeiro setor'),
    ));
    // FAB também
    container.appendChild(h('button', {
      class: 'fab',
      'aria-label': 'Criar novo setor',
      title: 'Criar novo setor',
      onClick: openCreateSectorModal,
    }, icon('plus')));
    return container;
  }

  const list = h('div', { class: 'sector-list' });
  for (const sector of data.sectors) list.appendChild(sectorCard(sector));
  container.appendChild(list);

  container.appendChild(h('button', {
    class: 'fab',
    'aria-label': 'Criar novo setor',
    title: 'Criar novo setor',
    onClick: openCreateSectorModal,
  }, icon('plus')));

  return container;
}

function sectorCard(sector) {
  const pots = selectPotsInSector(sector.id);
  const status = selectSectorStatus(sector.id);

  const overdue = ['liquid', 'solid', 'bicarbonate']
    .filter((t) => status?.[t]?.overdue);

  const card = h('a', {
    class: 'card sector-card',
    href: `#/setores/${sector.id}`,
  });

  const header = h('div', { class: 'sector-card-head' },
    h('div', { class: 'sector-card-title' },
      h('span', { class: 'sector-icon' }, icon('sector')),
      h('span', null, sector.name || 'Sem nome'),
    ),
    overdue.length
      ? h('span', { class: 'pill danger' }, h('span', { class: 'pill-dot' }), `${overdue.length} atrasado(s)`)
      : h('span', { class: 'pill' }, h('span', { class: 'pill-dot' }), 'em dia'),
  );

  const meta = h('div', { class: 'sector-meta mono small dim' },
    `${pots.length} planta${pots.length === 1 ? '' : 's'}`,
    ' · ',
    `${sector.intervals.liquid}d / ${sector.intervals.solid}d / ${sector.intervals.bicarbonate}d`,
  );

  const statusRow = h('div', { class: 'sector-status' });
  for (const t of ['liquid', 'solid', 'bicarbonate']) {
    const s = status?.[t];
    const stat = h('div', { class: `fert-chip ${s?.overdue ? 'overdue' : (s?.lastISO ? '' : 'never')}` },
      icon(FERT_TYPES[t].icon),
      h('span', null, FERT_TYPES[t].shortLabel),
      h('span', { class: 'fert-chip-meta mono' },
        s?.lastISO == null ? 'nunca' :
        s.overdue ? `+${s.daysSince - sector.intervals[t]}d` :
        `${s.daysSince}d`,
      ),
    );
    statusRow.appendChild(stat);
  }

  const actions = h('div', { class: 'sector-actions row', onClick: (e) => e.stopPropagation() },
    h('button', {
      class: 'btn btn-sm btn-primary',
      'aria-label': 'Adubar bloco inteiro',
      onClick: (e) => { e.preventDefault(); openBulkFertilizeModal(sector); },
    }, icon('droplet'), 'Adubar bloco'),
    h('button', {
      class: 'btn btn-sm btn-ghost',
      'aria-label': 'Editar setor',
      title: 'Editar setor',
      onClick: (e) => { e.preventDefault(); openEditSectorModal(sector); },
    }, icon('edit')),
    h('button', {
      class: 'btn btn-sm btn-ghost',
      'aria-label': 'Apagar setor',
      title: 'Apagar setor',
      onClick: async (e) => {
        e.preventDefault();
        const ok = await confirm(
          `Apagar setor "${sector.name}"? As plantas ficam sem setor (mas não são apagadas).`,
          { confirmLabel: 'Apagar', variant: 'btn-danger' },
        );
        if (ok) { await deleteSector(sector.id); rerender(); }
      },
    }, icon('trash')),
  );

  card.appendChild(header);
  card.appendChild(meta);
  card.appendChild(statusRow);
  card.appendChild(actions);
  return card;
}

async function openCreateSectorModal() {
  const name = h('input', {
    type: 'text', enterkeyhint: 'next',
    placeholder: 'frente, fundos, varanda…', required: true,
  });
  const desc = h('textarea', { placeholder: 'observações livres (sol, sombra, rega…)' });
  const liquid = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: '7' });
  const solid = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: '30' });
  const bica = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: '15' });

  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Nome do setor'), name),
    h('div', { class: 'field' }, h('label', null, 'Notas (opcional)'), desc),
    h('div', { class: 'field' },
      h('label', null, 'A cada quantos dias adubar?'),
      h('div', { class: 'hint' },
        'Você pode mudar depois. Padrão: líquido a cada 7d, sólido a cada 30d, bicarbonato a cada 15d.'),
      h('div', { class: 'field-row', style: { gridTemplateColumns: '1fr 1fr 1fr', marginTop: '8px' } },
        wrapInterval('Líquido', liquid, 'droplet'),
        wrapInterval('Sólido', solid, 'beaker'),
        wrapInterval('Bicarb.', bica, 'sparkle'),
      ),
    ),
  );

  const result = await openModal({
    title: 'Novo setor',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Criar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          if (!name.value.trim()) { name.focus(); return false; }
          await addSector({
            name: name.value,
            description: desc.value,
            intervals: { liquid: liquid.value, solid: solid.value, bicarbonate: bica.value },
          });
          close(true);
        },
      },
    ],
  });
  if (result) rerender();
}

export async function openEditSectorModal(sector) {
  const name = h('input', { type: 'text', enterkeyhint: 'next', value: sector.name, required: true });
  const desc = h('textarea', null);
  desc.value = sector.description || '';
  const liquid = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: String(sector.intervals.liquid) });
  const solid = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: String(sector.intervals.solid) });
  const bica = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: String(sector.intervals.bicarbonate) });

  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Nome do setor'), name),
    h('div', { class: 'field' }, h('label', null, 'Notas'), desc),
    h('div', { class: 'field' },
      h('label', null, 'Intervalos (dias)'),
      h('div', { class: 'field-row', style: { gridTemplateColumns: '1fr 1fr 1fr', marginTop: '8px' } },
        wrapInterval('Líquido', liquid, 'droplet'),
        wrapInterval('Sólido', solid, 'beaker'),
        wrapInterval('Bicarb.', bica, 'sparkle'),
      ),
    ),
  );

  const ok = await openModal({
    title: `Editar ${sector.name}`,
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Salvar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          if (!name.value.trim()) { name.focus(); return false; }
          await updateSector(sector.id, {
            name: name.value,
            description: desc.value,
            intervals: { liquid: liquid.value, solid: solid.value, bicarbonate: bica.value },
          });
          close(true);
        },
      },
    ],
  });
  if (ok) rerender();
}

function wrapInterval(label, input, ico) {
  return h('div', { class: 'interval-cell' },
    h('div', { class: 'row', style: { gap: '4px' } }, icon(ico), h('span', { class: 'small muted' }, label)),
    input,
  );
}
