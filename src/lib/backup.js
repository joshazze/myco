import {
  rawEncryptedBlob,
  setRawEncryptedBlob,
  loadEncryptedData,
  persistEncrypted,
  persistEncryptedWithKey,
} from './storage.js';
import {
  deriveKey,
  makeVerifier,
  checkVerifier,
  fromB64,
  toB64,
} from './crypto.js';
import { getMeta, getKey } from './auth.js';
import { putMasterKey } from './idb.js';
import { mutate, getState, setSession, nowISO } from './state.js';

const BACKUP_VERSION = 1;
const NAG_INTERVAL_MS = 7 * 86400_000;

export function isBackupNagDue(data) {
  const last = data?.settings?.lastBackupISO;
  if (!last) {
    const created = data?.settings?.createdAt;
    if (!created) return false;
    return Date.now() - new Date(created).getTime() >= NAG_INTERVAL_MS;
  }
  return Date.now() - new Date(last).getTime() >= NAG_INTERVAL_MS;
}

export function lastBackupSummary(data) {
  const last = data?.settings?.lastBackupISO;
  if (!last) return 'Você ainda não exportou nenhum backup.';
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400_000);
  if (days === 0) return 'Último backup: hoje.';
  if (days === 1) return 'Último backup: há 1 dia.';
  return `Último backup: há ${days} dias.`;
}

export async function exportEncryptedBackup() {
  const meta = getMeta();
  if (!meta) throw new Error('Sem conta autenticada.');
  const blob = rawEncryptedBlob();
  if (!blob) throw new Error('Sem dados pra exportar.');

  const envelope = {
    version: BACKUP_VERSION,
    app: 'myco',
    exportedAt: nowISO(),
    email: meta.email,
    salt: meta.salt,
    verifier: meta.verifier,
    payload: JSON.parse(blob),
  };

  const json = JSON.stringify(envelope, null, 2);
  const blobObj = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blobObj);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename(meta.email);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  await mutate((d) => {
    d.settings.lastBackupISO = nowISO();
  });

  return envelope.exportedAt;
}

export async function importEncryptedBackup(file, password) {
  const text = await file.text();
  let envelope;
  try { envelope = JSON.parse(text); }
  catch { throw new Error('Arquivo inválido — não é JSON.'); }
  if (!envelope || envelope.app !== 'myco' || !envelope.payload || !envelope.salt || !envelope.verifier) {
    throw new Error('Arquivo não é um backup do myco.');
  }
  if (envelope.version !== BACKUP_VERSION) {
    throw new Error(`Versão de backup ${envelope.version} desconhecida.`);
  }

  // Derive key from imported salt + provided password
  const saltBytes = fromB64(envelope.salt);
  const key = await deriveKey(password, saltBytes);
  const ok = await checkVerifier(key, envelope.verifier);
  if (!ok) throw new Error('Senha incorreta pro backup.');

  // Persist the encrypted blob + new auth meta + key in IDB
  setRawEncryptedBlob(JSON.stringify(envelope.payload));
  const newMeta = {
    email: envelope.email,
    salt: envelope.salt,
    verifier: envelope.verifier,
    createdAt: envelope.exportedAt || nowISO(),
  };
  localStorage.setItem('myco:auth', JSON.stringify(newMeta));
  await putMasterKey(key);

  // Reload data into memory
  // Manually thread the key — the auth module reads from IDB next time, but we
  // need to force the in-memory key for the immediate persistEncrypted later.
  // Easiest: set localStorage, reload page so bootstrap re-derives state cleanly.
  return { reload: true };
}

function backupFilename(email) {
  const slug = (email || 'backup').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);
  return `myco-${slug}-${today}.myco.json`;
}
