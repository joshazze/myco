import { encryptJSON, decryptJSON } from './crypto.js';
import { getKey } from './auth.js';

const DATA_KEY = 'myco:data';

export function emptyData() {
  return {
    pots: [],
    sectors: [],
    fertilizations: [],
    compostLots: [],
    _nextPotSeq: 1,
    settings: { lastBackupISO: null, createdAt: new Date().toISOString() },
  };
}

export function hasEncryptedData() {
  return !!localStorage.getItem(DATA_KEY);
}

export function rawEncryptedBlob() {
  return localStorage.getItem(DATA_KEY);
}

export function setRawEncryptedBlob(blobStr) {
  localStorage.setItem(DATA_KEY, blobStr);
}

// Sentinel errors pra UI de recovery distinguir "blob ausente" de "blob ilegível".
export class MissingDataError extends Error {
  constructor() { super('missing-data'); this.name = 'MissingDataError'; }
}
export class CorruptDataError extends Error {
  constructor(cause) { super('corrupt-data'); this.name = 'CorruptDataError'; this.cause = cause; }
}

export async function loadEncryptedData({ allowCreate = false } = {}) {
  const key = getKey();
  if (!key) throw new Error('Sem chave em memória.');
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    if (allowCreate) {
      const fresh = emptyData();
      await persistEncrypted(fresh);
      return fresh;
    }
    console.warn('[myco] loadEncryptedData: blob ausente mas allowCreate=false');
    throw new MissingDataError();
  }
  let blob;
  try {
    blob = JSON.parse(raw);
  } catch (e) {
    console.warn('[myco] loadEncryptedData: blob JSON inválido', e);
    throw new CorruptDataError(e);
  }
  try {
    return await decryptJSON(key, blob);
  } catch (e) {
    console.warn('[myco] loadEncryptedData: decrypt falhou', e);
    throw new CorruptDataError(e);
  }
}

export async function persistEncrypted(data) {
  const key = getKey();
  if (!key) throw new Error('Sem chave em memória.');
  const blob = await encryptJSON(key, data);
  localStorage.setItem(DATA_KEY, JSON.stringify(blob));
}

export async function persistEncryptedWithKey(data, key) {
  const blob = await encryptJSON(key, data);
  localStorage.setItem(DATA_KEY, JSON.stringify(blob));
}

export function wipeData() {
  localStorage.removeItem(DATA_KEY);
}
