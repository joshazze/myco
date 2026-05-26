import { h, icon } from '../components/ui.js';
import { openModal } from '../components/modal.js';
import {
  bulkFertilizeSector,
  addFertilization,
  FERT_TYPES,
  selectPotsInSector,
} from '../lib/state.js';
import { rerender } from '../lib/router.js';
import { toDateLocal, fromDateLocal } from '../lib/format.js';
import { pickAndResizePhoto } from '../lib/photos.js';

const TYPE_ORDER = ['liquid', 'solid', 'bicarbonate'];

function typeSelector({ initial }) {
  const wrap = h('div', { class: 'type-selector' });
  let selected = initial || 'liquid';

  const buttons = TYPE_ORDER.map((t) => {
    const conf = FERT_TYPES[t];
    const btn = h('button', {
      type: 'button',
      class: `type-chip ${t === selected ? 'active' : ''}`,
      dataset: { type: t },
      onClick: () => {
        selected = t;
        for (const b of buttons) b.classList.toggle('active', b.dataset.type === selected);
      },
    },
      icon(conf.icon),
      h('span', null, conf.label),
    );
    return btn;
  });

  for (const b of buttons) wrap.appendChild(b);

  return {
    el: wrap,
    get value() { return selected; },
  };
}

function dateField(initialISO) {
  const input = h('input', {
    type: 'date',
    value: toDateLocal(initialISO || new Date().toISOString()),
  });
  return {
    el: h('div', { class: 'field' }, h('label', null, 'Data'), input),
    get value() { return fromDateLocal(input.value) || new Date().toISOString(); },
  };
}

function doseField() {
  const input = h('input', {
    type: 'text',
    placeholder: '100ml, 1 colher, 2 punhados…',
  });
  return {
    el: h('div', { class: 'field' }, h('label', null, 'Dose'), input),
    get value() { return input.value; },
  };
}

function notesField(placeholder) {
  const textarea = h('textarea', { placeholder: placeholder || 'observações livres' });
  return {
    el: h('div', { class: 'field' }, h('label', null, 'Observação'), textarea),
    get value() { return textarea.value; },
  };
}

function photoField() {
  let photoData = null;

  const preview = h('img', { class: 'photo-preview', alt: 'foto', hidden: true });
  const placeholder = h('div', { class: 'photo-placeholder' }, icon('camera'), 'Tirar/escolher foto');

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    style: { display: 'none' },
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      placeholder.textContent = 'Processando…';
      try {
        photoData = await pickAndResizePhoto(file);
        preview.src = photoData;
        preview.hidden = false;
        placeholder.hidden = true;
      } catch (err) {
        placeholder.textContent = `Erro: ${err.message}`;
      }
    },
  });

  const trigger = h('button', {
    type: 'button',
    class: 'photo-trigger',
    onClick: () => fileInput.click(),
  }, placeholder, preview);

  const clear = h('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    onClick: () => {
      photoData = null;
      preview.hidden = true;
      placeholder.hidden = false;
      placeholder.innerHTML = '';
      placeholder.appendChild(icon('camera'));
      placeholder.appendChild(document.createTextNode('Tirar/escolher foto'));
      fileInput.value = '';
    },
  }, icon('x'), 'Remover');

  const el = h('div', { class: 'field' },
    h('label', null, 'Foto (opcional)'),
    trigger,
    fileInput,
    h('div', { class: 'small dim', style: { marginTop: '4px' } }, clear),
  );

  return {
    el,
    get value() { return photoData; },
  };
}

export async function openBulkFertilizeModal(sector) {
  const pots = selectPotsInSector(sector.id);
  if (!pots.length) {
    await openModal({
      title: `Adubar ${sector.name}`,
      body: h('p', { class: 'muted' },
        'Esse setor ainda não tem vasos. Crie pelo menos um na Pokédex pra registrar uma adubação em bloco.'),
      actions: [{ label: 'Entendi', variant: 'btn-primary', value: true }],
    });
    return;
  }

  const type = typeSelector({ initial: 'liquid' });
  const date = dateField();
  const dose = doseField();
  const notes = notesField();

  const body = h('div', null,
    h('div', { class: 'field' },
      h('label', null, 'Tipo'),
      type.el,
    ),
    date.el,
    dose.el,
    notes.el,
    h('div', { class: 'small dim' },
      `Vai criar ${pots.length} entrada${pots.length === 1 ? '' : 's'} — uma por vaso do setor.`),
  );

  const result = await openModal({
    title: `Adubar bloco · ${sector.name}`,
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: `Adubar ${pots.length}`,
        variant: 'btn-primary',
        onClick: async (_, close) => {
          await bulkFertilizeSector({
            sectorId: sector.id,
            type: type.value,
            dateISO: date.value,
            dose: dose.value,
            notes: notes.value,
          });
          close(true);
        },
      },
    ],
  });
  if (result) rerender();
}

export async function openFertilizePotModal(pot) {
  const type = typeSelector({ initial: 'liquid' });
  const date = dateField();
  const dose = doseField();
  const notes = notesField();
  const photo = photoField();

  const body = h('div', null,
    h('div', { class: 'field' },
      h('label', null, 'Tipo'),
      type.el,
    ),
    date.el,
    dose.el,
    notes.el,
    photo.el,
  );

  const result = await openModal({
    title: `Adubar ${pot.displayId} ${pot.name}`,
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Registrar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          await addFertilization({
            type: type.value,
            potId: pot.id,
            dateISO: date.value,
            dose: dose.value,
            notes: notes.value,
            photo: photo.value,
          });
          close(true);
        },
      },
    ],
  });
  if (result) rerender();
}
