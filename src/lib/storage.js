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

export async function loadEncryptedData() {
  const key = getKey();
  if (!key) throw new Error('Sem chave em memória.');
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    const fresh = emptyData();
    await persistEncrypted(fresh);
    return fresh;
  }
  const blob = JSON.parse(raw);
  return decryptJSON(key, blob);
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
