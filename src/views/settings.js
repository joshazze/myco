import { h, icon, errorBox } from '../components/ui.js';
import { openModal, confirm } from '../components/modal.js';
import {
  changePassword,
  wipeAuthAndData,
  getMeta,
} from '../lib/auth.js';
import { getState, FERT_TYPES, selectLastFertForSector } from '../lib/state.js';
import { buildICS, buildSectorReminderEvent, downloadICS, icsFilename } from '../lib/ics.js';
import { fmtDateFull } from '../lib/format.js';

export async function renderSettings() {
  const { data } = getState();
  const meta = getMeta();
  const container = h('div');

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Ajustes'),
  ));

  // Conta
  container.appendChild(h('div', { class: 'card', style: { marginBottom: '12px' } },
    h('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } },
      h('div', { style: { color: 'var(--accent)' } }, icon('leaf')),
      h('strong', null, 'Conta'),
    ),
    h('div', { class: 'small' },
      h('div', null, h('span', { class: 'dim' }, 'Email: '), meta?.email || '—'),
      h('div', null, h('span', { class: 'dim' }, 'Criada em: '), meta?.createdAt ? fmtDateFull(meta.createdAt) : '—'),
    ),
  ));

  // Calendário
  const sectorsWithReminders = data.sectors;
  container.appendChild(h('div', { class: 'card', style: { marginBottom: '12px' } },
    h('div', { class: 'row', style: { gap: '10px', marginBottom: '8px' } },
      h('div', { style: { color: 'var(--accent)' } }, icon('calendar')),
      h('strong', null, 'Calendário'),
    ),
    h('p', { class: 'small dim', style: { margin: '0 0 12px' } },
      sectorsWithReminders.length
        ? `Exporta um .ics com lembretes recorrentes (RRULE) pra ${sectorsWithReminders.length} setor(es) × 3 tipos. Importe no Calendar.app/iOS pra agendar.`
        : 'Crie pelo menos um setor pra gerar lembretes recorrentes.',
    ),
    h('button', {
      class: 'btn btn-primary',
      disabled: !sectorsWithReminders.length || null,
      onClick: () => exportAllSectorsCalendar(),
    }, icon('download'), 'Exportar .ics'),
  ));

  // Backup link
  container.appendChild(h('a', {
    class: 'card row',
    href: '#/backup',
    style: { marginBottom: '12px', textDecoration: 'none', color: 'inherit', gap: '10px' },
  },
    h('div', { style: { color: 'var(--accent)' } }, icon('download')),
    h('div', null,
      h('strong', null, 'Backup'),
      h('div', { class: 'small dim' }, 'Exportar/importar JSON cifrado'),
    ),
    h('div', { class: 'spacer' }),
    icon('chevronR'),
  ));

  // Mudar senha
  container.appendChild(h('div', { class: 'card', style: { marginBottom: '12px' } },
    h('div', { class: 'row', style: { gap: '10px', marginBottom: '12px' } },
      h('div', { style: { color: 'var(--accent)' } }, icon('lock')),
      h('strong', null, 'Segurança'),
    ),
    h('button', {
      class: 'btn btn-ghost btn-block',
      onClick: () => openChangePasswordModal(),
    }, icon('edit'), 'Trocar senha'),
    h('p', { class: 'small dim', style: { margin: '8px 0 0' } },
      'Re-cifra todo o blob local com uma nova chave. A senha antiga deixa de servir.',
    ),
  ));

  // Wipe
  container.appendChild(h('div', { class: 'card', style: { marginBottom: '12px', borderColor: 'var(--danger)' } },
    h('div', { class: 'row', style: { gap: '10px', marginBottom: '12px' } },
      h('div', { style: { color: 'var(--danger)' } }, icon('warning')),
      h('strong', null, 'Apagar conta'),
    ),
    h('p', { class: 'small dim', style: { margin: '0 0 12px' } },
      'Apaga conta, chave em IDB e blob cifrado. Não tem volta.',
    ),
    h('button', {
      class: 'btn btn-danger btn-block',
      onClick: async () => {
        const ok = await confirm(
          'Apagar conta + TODOS os dados deste device? Isso não pode ser desfeito.',
          { confirmLabel: 'Apagar tudo', variant: 'btn-danger' },
        );
        if (!ok) return;
        const ok2 = await confirm(
          'Tem certeza? Faça um backup antes se quer manter os dados.',
          { confirmLabel: 'Sim, apagar', variant: 'btn-danger' },
        );
        if (!ok2) return;
        await wipeAuthAndData();
        location.reload();
      },
    }, icon('trash'), 'Apagar conta'),
  ));

  return container;
}

async function openChangePasswordModal() {
  const oldPwd = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'senha atual' });
  const newPwd = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'nova senha (min 8)' });
  const confirmPwd = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'confirmar nova senha' });
  const errSlot = h('div');

  const body = h('div', null,
    h('p', { class: 'small dim' },
      'Vai re-cifrar o banco local com a nova chave. Pode levar alguns segundos.'),
    h('div', { class: 'field' }, h('label', null, 'Senha atual'), oldPwd),
    h('div', { class: 'field' }, h('label', null, 'Nova senha'), newPwd),
    h('div', { class: 'field' }, h('label', null, 'Confirmar'), confirmPwd),
    errSlot,
  );

  await openModal({
    title: 'Trocar senha',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Trocar',
        variant: 'btn-primary',
        onClick: async (_, close) => {
          errSlot.innerHTML = '';
          if (newPwd.value.length < 8) {
            errSlot.appendChild(errorBox('Nova senha precisa ter pelo menos 8 caracteres.'));
            return false;
          }
          if (newPwd.value !== confirmPwd.value) {
            errSlot.appendChild(errorBox('As novas senhas não conferem.'));
            return false;
          }
          try {
            const data = getState().data;
            await changePassword(oldPwd.value, newPwd.value, data);
            close(true);
          } catch (e) {
            errSlot.appendChild(errorBox(e.message));
            return false;
          }
        },
      },
    ],
  });
}

function exportAllSectorsCalendar() {
  const { data } = getState();
  const events = [];
  for (const sector of data.sectors) {
    for (const t of ['liquid', 'solid', 'bicarbonate']) {
      const last = selectLastFertForSector(sector.id, t);
      events.push(buildSectorReminderEvent(sector, t, FERT_TYPES[t].label, last?.dateISO));
    }
  }
  const ics = buildICS(events);
  downloadICS(icsFilename('myco-jardim'), ics);
}
