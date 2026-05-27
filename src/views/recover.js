import { h, icon, errorBox } from '../components/ui.js';
import { openModal, confirm } from '../components/modal.js';
import { wipeAuthAndData, getMeta } from '../lib/auth.js';
import { importEncryptedBackup } from '../lib/backup.js';
import { hasEncryptedData, rawEncryptedBlob } from '../lib/storage.js';

export async function renderRecover() {
  const wrap = h('div', { class: 'auth-wrap' });
  const card = h('div', { class: 'auth-card glow-card' });
  wrap.appendChild(card);

  const meta = getMeta() || JSON.parse(localStorage.getItem('myco:auth') || 'null');
  const hasBlob = hasEncryptedData();
  const blobLen = (rawEncryptedBlob() || '').length;

  card.appendChild(h('div', { class: 'brand-mark' },
    h('span', { class: 'brand-sigil', style: { color: 'var(--warm)' } }, icon('warning')),
    h('span', { class: 'brand-name' }, 'myco'),
  ));

  card.appendChild(h('h1', null, hasBlob ? 'Não consegui ler seus dados' : 'Seus dados sumiram'));
  card.appendChild(h('p', { class: 'sub' },
    hasBlob
      ? 'O blob cifrado está aqui, mas a chave atual não decifra ele. Pode ter sido troca de senha incompleta ou eviction parcial do navegador. Tente importar um backup; se não tiver, vai precisar recomeçar.'
      : 'Não achei seu blob cifrado neste dispositivo, mas a conta ainda existe. Isso geralmente é eviction de storage do navegador. Importe seu último backup pra voltar onde parou.',
  ));

  if (meta?.email) {
    card.appendChild(h('p', { class: 'small dim', style: { marginTop: '-6px' } },
      `Conta: ${meta.email}`,
    ));
  }

  card.appendChild(h('div', { class: 'small dim mono', style: { marginTop: '8px' } },
    `Diagnóstico: blob=${hasBlob ? `${blobLen}B` : 'ausente'} · auth=${meta ? 'ok' : 'ausente'}`,
  ));

  const errSlot = h('div');

  const importBtn = h('button', {
    class: 'btn btn-primary btn-block',
    style: { marginTop: '16px' },
    onClick: () => openImportFlow(errSlot),
  }, icon('upload'), 'Importar backup');

  const wipeBtn = h('button', {
    class: 'btn btn-danger btn-block',
    style: { marginTop: '10px' },
    onClick: async () => {
      const ok = await confirm(
        'Apagar conta e blob deste dispositivo? Sem backup, isso não tem volta.',
        { confirmLabel: 'Apagar tudo', variant: 'btn-danger' },
      );
      if (!ok) return;
      await wipeAuthAndData();
      location.reload();
    },
  }, icon('trash'), 'Recomeçar do zero');

  card.appendChild(importBtn);
  card.appendChild(wipeBtn);
  card.appendChild(errSlot);

  return wrap;
}

async function openImportFlow(errOuter) {
  const file = h('input', { type: 'file', accept: '.json,application/json' });
  const pwd = h('input', { type: 'password', placeholder: 'senha do backup', autocomplete: 'current-password' });
  const errSlot = h('div');

  const body = h('div', null,
    h('p', { class: 'muted small' },
      'Substitui o que está aqui agora. Use a senha que vigorava quando você exportou o arquivo.'),
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
          errOuter.innerHTML = '';
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
