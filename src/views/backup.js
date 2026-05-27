import { h, icon, errorBox } from '../components/ui.js';
import { openModal } from '../components/modal.js';
import { currentQuery } from '../lib/router.js';
import {
  exportEncryptedBackup,
  importEncryptedBackup,
  lastBackupSummary,
} from '../lib/backup.js';
import { getState } from '../lib/state.js';

export async function renderBackup() {
  const { data } = getState();
  const container = h('div');
  const firstRun = currentQuery().get('firstRun') === '1';

  container.appendChild(h('div', { class: 'section-head' },
    h('h2', null, 'Backup'),
    h('span', { class: 'pill' }, h('span', { class: 'pill-dot' }), 'cifrado'),
  ));

  if (firstRun) {
    container.appendChild(h('div', { class: 'alert-card alert-warm', style: { marginBottom: '14px' } },
      h('div', { class: 'alert-icon' }, icon('warning')),
      h('div', { class: 'alert-body' },
        h('strong', null, 'Antes de tudo: exporte um backup vazio'),
        h('div', { class: 'small muted' },
          'Esse arquivo cifrado é sua âncora de recuperação. Se algum dia o navegador apagar o storage, '
          + 'você importa esse backup e cai exatamente onde estava — desde que tenha a mesma senha.'),
      ),
      h('a', { class: 'btn btn-ghost btn-sm', href: '#/' }, 'Pular'),
    ));
  }

  container.appendChild(h('p', { class: 'muted' },
    'Exporta um JSON cifrado com TUDO (vasos, setores, adubações, lotes, fotos). Pra abrir em outro device ou recuperar, ',
    'você vai precisar da mesma senha que cifra a conta atual.',
  ));

  // Export card
  const errSlot = h('div');
  const exportBtn = h('button', {
    class: 'btn btn-primary',
    onClick: async () => {
      errSlot.innerHTML = '';
      try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exportando…';
        await exportEncryptedBackup();
        exportBtn.disabled = false;
        exportBtn.innerHTML = '';
        exportBtn.appendChild(icon('download'));
        exportBtn.appendChild(document.createTextNode('Exportar backup'));
        location.reload();
      } catch (e) {
        errSlot.appendChild(errorBox(e.message));
        exportBtn.disabled = false;
        exportBtn.innerHTML = '';
        exportBtn.appendChild(icon('download'));
        exportBtn.appendChild(document.createTextNode('Exportar backup'));
      }
    },
  }, icon('download'), 'Exportar backup');

  container.appendChild(h('div', { class: 'card', style: { marginTop: '14px' } },
    h('div', { class: 'row', style: { gap: '12px', marginBottom: '12px' } },
      h('div', { style: { color: 'var(--accent)' } }, icon('download')),
      h('div', null,
        h('strong', null, 'Exportar backup'),
        h('div', { class: 'small muted' }, lastBackupSummary(data)),
      ),
    ),
    exportBtn,
    errSlot,
  ));

  // Import card
  const importErr = h('div');
  const importBtn = h('button', {
    class: 'btn btn-ghost',
    onClick: () => openImportModal(),
  }, icon('upload'), 'Importar backup');

  container.appendChild(h('div', { class: 'card', style: { marginTop: '14px' } },
    h('div', { class: 'row', style: { gap: '12px', marginBottom: '12px' } },
      h('div', { style: { color: 'var(--warm)' } }, icon('upload')),
      h('div', null,
        h('strong', null, 'Importar backup'),
        h('div', { class: 'small muted' },
          'Substitui o estado atual. A senha precisa ser a senha usada quando o backup foi exportado.'),
      ),
    ),
    importBtn,
    importErr,
  ));

  return container;
}

async function openImportModal() {
  const file = h('input', { type: 'file', accept: '.json,application/json' });
  const pwd = h('input', { type: 'password', placeholder: 'senha do backup', autocomplete: 'current-password' });
  const errSlot = h('div');

  const body = h('div', null,
    h('p', { class: 'muted small' },
      'Atenção: vai substituir TUDO neste dispositivo. Faça um export antes se houver dados que valem manter.'),
    h('div', { class: 'field' }, h('label', null, 'Arquivo .myco.json'), file),
    h('div', { class: 'field' }, h('label', null, 'Senha do backup'), pwd),
    errSlot,
  );

  await openModal({
    title: 'Importar backup',
    body,
    actions: [
      { label: 'Cancelar', variant: 'btn-ghost', value: null },
      {
        label: 'Importar',
        variant: 'btn-warm',
        onClick: async (_, close) => {
          errSlot.innerHTML = '';
          const f = file.files?.[0];
          if (!f) { errSlot.appendChild(errorBox('Escolha o arquivo .myco.json.')); return false; }
          if (!pwd.value) { errSlot.appendChild(errorBox('Informe a senha.')); return false; }
          try {
            const result = await importEncryptedBackup(f, pwd.value);
            close(true);
            if (result?.reload) location.reload();
          } catch (e) {
            errSlot.appendChild(errorBox(e.message));
            return false;
          }
        },
      },
    ],
  });
}
