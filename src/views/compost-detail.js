import { h, icon, emptyState } from '../components/ui.js';
import { openModal, confirm } from '../components/modal.js';
import {
  getState,
  startLot,
  completeLot,
  emptyLot,
  deleteLot,
  updateLotNotes,
  selectActiveLot,
  selectLotsForBox,
} from '../lib/state.js';
import { rerender, navigate } from '../lib/router.js';
import { fmtDateFull, toDateLocal, fromDateLocal, daysBetween, fmtDaysAgo } from '../lib/format.js';

export async function renderCompostDetail({ n }) {
  const boxNumber = Number(n);
  const container = h('div');

  if (![1, 2, 3, 4].includes(boxNumber)) {
    container.appendChild(emptyState('Caixa inválida',
      h('a', { href: '#/composto' }, 'Voltar')));
    return container;
  }

  const active = selectActiveLot(boxNumber);
  const lots = selectLotsForBox(boxNumber);

  container.appendChild(h('div', { class: 'back-link' },
    h('a', { href: '#/composto', class: 'row dim small' }, icon('arrowLeft'), 'Compostagem'),
  ));

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, `Caixa ${boxNumber}`),
    !active
      ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => openStartLotModal(boxNumber) },
          icon('plus'), 'Iniciar lote')
      : null,
  ));

  // Active lot card
  if (active) {
    container.appendChild(activeLotCard(active));
  } else {
    container.appendChild(emptyState(
      'Caixa vazia',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } },
        'Clique "Iniciar lote" pra começar um novo ciclo de maturação.'),
    ));
  }

  // Timeline anteriores
  const past = lots.filter((l) => l.emptiedISO);
  if (past.length) {
    container.appendChild(h('h3', { class: 'subhead', style: { marginTop: '22px' } },
      `Histórico · ${past.length} lote${past.length === 1 ? '' : 's'}`));
    const list = h('div', { class: 'lot-timeline' });
    for (const lot of past) list.appendChild(lotHistoryRow(lot));
    container.appendChild(list);
  }

  return container;
}

function activeLotCard(lot) {
  const today = new Date().toISOString();
  const ageDays = daysBetween(lot.startedISO, today);
  const ripenDays = lot.completedISO ? daysBetween(lot.startedISO, lot.completedISO) : null;
  const sinceCompleteDays = lot.completedISO ? daysBetween(lot.completedISO, today) : null;

  const phase = lot.completedISO ? 'completed' : 'maturing';

  const card = h('div', { class: `card active-lot ${phase}` });

  card.appendChild(h('div', { class: 'active-lot-head' },
    h('div', null,
      h('div', { class: 'mono small dim' }, `Lote #${shortLotId(lot.id)}`),
      h('div', { class: 'active-lot-title' },
        phase === 'completed' ? 'Pronto pra esvaziar' : 'Em maturação',
      ),
    ),
    h('span', { class: `pill ${phase === 'completed' ? 'warm' : ''}` },
      h('span', { class: 'pill-dot' }),
      phase === 'completed' ? `+${sinceCompleteDays}d completo` : `${ageDays}d maturando`,
    ),
  ));

  // Timeline
  card.appendChild(h('div', { class: 'phase-timeline' },
    phaseStep('iniciada', lot.startedISO, true),
    phaseStep('completa', lot.completedISO, !!lot.completedISO),
    phaseStep('esvaziada', lot.emptiedISO, !!lot.emptiedISO),
  ));

  // Notes
  const notesArea = h('textarea', {
    class: 'lot-notes',
    placeholder: 'insumos do lote (borra de café, casca de banana, aparas…)',
    onBlur: async (e) => {
      if (e.target.value.trim() !== (lot.notes || '').trim()) {
        await updateLotNotes(lot.id, e.target.value);
      }
    },
  });
  notesArea.value = lot.notes || '';
  card.appendChild(h('div', { class: 'field', style: { marginTop: '14px' } },
    h('label', null, 'Notas do lote'),
    notesArea,
  ));

  // Actions
  const actions = h('div', { class: 'row', style: { marginTop: '12px', gap: '8px' } });
  if (!lot.completedISO) {
    actions.appendChild(h('button', {
      class: 'btn btn-primary',
      onClick: () => openCompleteLotModal(lot),
    }, icon('check'), 'Marcar completa'));
  } else {
    actions.appendChild(h('button', {
      class: 'btn btn-warm',
      onClick: () => openEmptyLotModal(lot),
    }, icon('upload'), 'Esvaziar caixa'));
  }
  actions.appendChild(h('button', {
    class: 'btn btn-ghost',
    onClick: async () => {
      const ok = await confirm(`Apagar lote #${shortLotId(lot.id)} (em andamento)?`,
        { confirmLabel: 'Apagar', variant: 'btn-danger' });
      if (ok) { await deleteLot(lot.id); rerender(); }
    },
  }, icon('trash')));
  card.appendChild(actions);

  if (ripenDays != null && lot.completedISO) {
    card.appendChild(h('div', { class: 'small dim mono', style: { marginTop: '8px' } },
      `tempo de maturação: ${ripenDays}d`));
  }

  return card;
}

function phaseStep(label, iso, active) {
  return h('div', { class: `phase-step ${active ? 'active' : ''}` },
    h('div', { class: 'phase-dot' }),
    h('div', { class: 'phase-meta' },
      h('div', { class: 'phase-label' }, label),
      h('div', { class: 'mono small dim' }, iso ? fmtDateFull(iso).replace(/-feira/, '') : '—'),
    ),
  );
}

function lotHistoryRow(lot) {
  const ripen = daysBetween(lot.startedISO, lot.completedISO || lot.emptiedISO);
  return h('div', { class: 'lot-history-row' },
    h('div', { class: 'lot-history-icon' }, icon('compost')),
    h('div', { class: 'lot-history-body' },
      h('div', { class: 'lot-history-head' },
        h('strong', null, `Lote #${shortLotId(lot.id)}`),
        h('span', { class: 'mono small dim', style: { marginLeft: '8px' } },
          `${ripen}d`),
      ),
      h('div', { class: 'small dim mono' },
        `${shortDate(lot.startedISO)} → ${shortDate(lot.emptiedISO)}`,
      ),
      lot.destination ? h('div', { class: 'small', style: { marginTop: '4px' } },
        h('span', { class: 'dim' }, 'destino: '), lot.destination) : null,
      lot.notes ? h('div', { class: 'small', style: { marginTop: '2px' } },
        h('span', { class: 'dim' }, 'notas: '), lot.notes) : null,
    ),
    h('button', {
      class: 'btn btn-sm btn-ghost',
      onClick: async () => {
        const ok = await confirm(`Apagar lote #${shortLotId(lot.id)} do histórico?`,
          { confirmLabel: 'Apagar', variant: 'btn-danger' });
        if (ok) { await deleteLot(lot.id); rerender(); }
      },
    }, icon('trash')),
  );
}

function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}

function shortLotId(id) {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

async function openStartLotModal(boxNumber) {
  const date = h('input', { type: 'date', value: toDateLocal(new Date().toISOString()) });
  const notes = h('textarea', { placeholder: 'insumos iniciais (opcional)' });

  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Data de início'), date),
    h('div', { class: 'field' }, h('label', null, 'Notas'), notes),
  );

  const ok = await openModal({
    title: `Iniciar lote · Caixa ${boxNumber}`,
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Iniciar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          await startLot({
            boxNumber,
            startedISO: fromDateLocal(date.value),
            notes: notes.value,
          });
          close(true);
        },
      },
    ],
  });
  if (ok) rerender();
}

async function openCompleteLotModal(lot) {
  const date = h('input', { type: 'date', value: toDateLocal(new Date().toISOString()) });
  const body = h('div', null,
    h('p', { class: 'muted small' },
      'Marca quando o composto ficou pronto. Depois é só esvaziar quando for usar.'),
    h('div', { class: 'field' }, h('label', null, 'Data de conclusão'), date),
  );
  const ok = await openModal({
    title: 'Marcar completa',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Marcar completa',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          await completeLot(lot.id, fromDateLocal(date.value));
          close(true);
        },
      },
    ],
  });
  if (ok) rerender();
}

async function openEmptyLotModal(lot) {
  const date = h('input', { type: 'date', value: toDateLocal(new Date().toISOString()) });
  const dest = h('textarea', {
    placeholder: 'jardim da frente + dois vasos da varanda; sobrou um pouco…',
  });
  const body = h('div', null,
    h('p', { class: 'muted small' },
      'Esvaziar fecha o ciclo. Anota onde foi parar pra cruzar com adubação dos setores.'),
    h('div', { class: 'field' }, h('label', null, 'Data de esvaziamento'), date),
    h('div', { class: 'field' }, h('label', null, 'Destino'), dest),
  );
  const ok = await openModal({
    title: 'Esvaziar caixa',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Esvaziar',
        variant: 'btn-warm',
        onClick: async (_, close) => {
          await emptyLot(lot.id, {
            emptiedISO: fromDateLocal(date.value),
            destination: dest.value,
          });
          close(true);
        },
      },
    ],
  });
  if (ok) rerender();
}
