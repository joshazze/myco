import { h, icon, emptyState } from '../components/ui.js';
import { openModal } from '../components/modal.js';
import {
  getState,
  addPot,
} from '../lib/state.js';
import { rerender } from '../lib/router.js';
import { toDateLocal, fromDateLocal } from '../lib/format.js';
import { pickAndResizePhoto } from '../lib/photos.js';

export async function renderPots({ query } = {}) {
  const { data } = getState();
  const container = h('div');

  const filterSectorId = query?.get('setor') || null;

  // Quando jardim totalmente vazio, mostrar onboarding contextual aqui também
  if (data.pots.length === 0 && data.sectors.length === 0) {
    container.appendChild(h('div', { class: 'section-head' }, h('h2', null, 'Pokédex')));
    container.appendChild(h('div', { class: 'empty' },
      h('strong', null, 'Antes de cadastrar plantas'),
      h('p', { style: { margin: '6px 0 14px' } },
        'Crie pelo menos um setor — assim você sabe onde cada planta está.'),
      h('a', { class: 'btn btn-primary', href: '#/setores' }, icon('plus'), 'Criar primeiro setor'),
    ));
    return container;
  }

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Pokédex'),
    h('button', {
      class: 'btn btn-primary btn-sm',
      onClick: () => openCreatePotModal({ defaultSectorId: filterSectorId }),
    }, icon('plus'), 'Nova planta'),
  ));

  // Filter chips
  if (data.sectors.length > 0) {
    const chips = h('div', { class: 'sector-chips' });
    chips.appendChild(filterChip({ label: 'todas', active: !filterSectorId, href: '#/pokedex' }));
    for (const s of data.sectors) {
      chips.appendChild(filterChip({
        label: s.name,
        active: filterSectorId === s.id,
        href: `#/pokedex?setor=${s.id}`,
      }));
    }
    chips.appendChild(filterChip({
      label: 'sem setor',
      active: filterSectorId === 'none',
      href: '#/pokedex?setor=none',
    }));
    container.appendChild(chips);
  }

  let pots = data.pots;
  if (filterSectorId === 'none') pots = pots.filter((p) => !p.sectorId);
  else if (filterSectorId) pots = pots.filter((p) => p.sectorId === filterSectorId);

  if (!pots.length) {
    container.appendChild(emptyState(
      data.pots.length ? 'Nenhuma planta neste filtro' : 'Pokédex vazia',
      h('p', { style: { margin: '6px 0 14px' } },
        data.pots.length
          ? 'Tente outro setor — ou toque no "+" pra adicionar uma planta aqui.'
          : 'Toque no "+" pra adicionar a primeira planta.'),
    ));
  } else {
    const grid = h('div', { class: 'pot-grid' });
    for (const p of pots) grid.appendChild(potCard(p, data));
    container.appendChild(grid);
  }

  // FAB — ação primária sempre acessível em mobile
  container.appendChild(h('button', {
    class: 'fab',
    'aria-label': 'Adicionar nova planta',
    title: 'Adicionar nova planta',
    onClick: () => openCreatePotModal({ defaultSectorId: filterSectorId }),
  }, icon('plus')));

  return container;
}

function filterChip({ label, active, href }) {
  return h('a', { class: `chip ${active ? 'active' : ''}`, href }, label);
}

function potCard(p, data) {
  const sector = data.sectors.find((s) => s.id === p.sectorId);
  return h('a', { class: 'pot-card', href: `#/pokedex/${p.id}` },
    h('div', { class: 'pot-card-photo' },
      p.photo
        ? h('img', { src: p.photo, alt: p.name })
        : h('div', { class: 'placeholder' }, icon('pot')),
      h('div', { class: 'pot-id mono' }, p.displayId),
    ),
    h('div', { class: 'pot-card-body' },
      h('div', { class: 'pot-card-name' }, p.name),
      h('div', { class: 'pot-card-meta small dim' },
        p.species ? h('span', { class: 'italic' }, p.species) : null,
        p.species && sector ? ' · ' : null,
        sector ? sector.name : (p.species ? null : 'sem setor'),
      ),
    ),
  );
}

async function openCreatePotModal({ defaultSectorId }) {
  const { data } = getState();
  const name = h('input', { type: 'text', enterkeyhint: 'next', placeholder: 'ex: manjericão da janela', required: true });
  const species = h('input', { type: 'text', enterkeyhint: 'next', placeholder: 'opcional, ex: Ocimum basilicum' });
  const planted = h('input', { type: 'date', value: toDateLocal(new Date().toISOString()) });
  const desc = h('textarea', { placeholder: 'qualquer nota sobre a planta' });

  const sectorSelect = h('select', null,
    h('option', { value: '' }, '— sem setor —'),
    ...data.sectors.map((s) => h('option', { value: s.id }, s.name)),
  );
  if (defaultSectorId && defaultSectorId !== 'none') sectorSelect.value = defaultSectorId;

  const photo = buildPhotoField();

  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Nome'), name),
    h('div', { class: 'field' }, h('label', null, 'Espécie (opcional)'), species),
    h('div', { class: 'field' }, h('label', null, 'Quando você plantou/ganhou'), planted),
    h('div', { class: 'field' }, h('label', null, 'Setor'), sectorSelect),
    h('div', { class: 'field' }, h('label', null, 'Notas (opcional)'), desc),
    photo.fieldEl,
  );

  const ok = await openModal({
    title: 'Nova planta',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Salvar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          if (!name.value.trim()) { name.focus(); return false; }
          await addPot({
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

/* Reusable photo field builder — sem src='' nos elementos */
export function buildPhotoField(initial = null) {
  let photoData = initial;

  const preview = h('img', { class: 'photo-preview', alt: 'foto da planta' });
  if (initial) preview.src = initial;
  preview.hidden = !initial;

  const placeholder = h('div', { class: 'photo-placeholder' },
    icon('camera'),
    h('span', null, initial ? 'Trocar foto' : 'Tirar/escolher foto'),
  );
  placeholder.hidden = !!initial;

  const file = h('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    'aria-label': 'Foto da planta',
    style: { display: 'none' },
    onChange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      placeholder.innerHTML = '';
      placeholder.appendChild(document.createTextNode('Processando…'));
      try {
        photoData = await pickAndResizePhoto(f);
        preview.src = photoData;
        preview.hidden = false;
        placeholder.hidden = true;
      } catch (err) {
        placeholder.innerHTML = '';
        placeholder.appendChild(document.createTextNode(`Erro: ${err.message}`));
      }
    },
  });

  const trigger = h('button', {
    type: 'button',
    class: 'photo-trigger',
    'aria-label': 'Escolher ou tirar foto',
    onClick: () => file.click(),
  }, placeholder, preview);

  const clearBtn = h('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    onClick: () => {
      photoData = null;
      preview.hidden = true;
      preview.removeAttribute('src');
      placeholder.hidden = false;
      placeholder.innerHTML = '';
      placeholder.appendChild(icon('camera'));
      placeholder.appendChild(document.createTextNode('Tirar/escolher foto'));
      file.value = '';
    },
  }, icon('x'), 'Remover');

  const fieldEl = h('div', { class: 'field' },
    h('label', null, 'Foto (opcional)'),
    trigger,
    file,
    h('div', { style: { marginTop: '6px' } }, clearBtn),
  );

  return {
    fieldEl,
    get value() { return photoData; },
  };
}
