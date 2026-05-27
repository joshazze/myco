import {
  deriveKey,
  makeVerifier,
  checkVerifier,
  encryptJSON,
  randomBytes,
  toB64,
  fromB64,
} from './crypto.js';
import { putMasterKey, getMasterKey, clearMasterKey } from './idb.js';

const AUTH_KEY = 'myco:auth';

let currentKey = null;
let currentMeta = null;

export function hasAuth() {
  return !!localStorage.getItem(AUTH_KEY);
}

export function getKey() {
  return currentKey;
}

export function getMeta() {
  return currentMeta;
}

function readMeta() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeMeta(meta) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(meta));
}

export async function signup(email, password) {
  if (hasAuth()) throw new Error('Conta já existe neste dispositivo.');
  const saltBytes = randomBytes(16);
  const key = await deriveKey(password, saltBytes);
  const verifier = await makeVerifier(key);
  const meta = {
    email: email.trim().toLowerCase(),
    salt: toB64(saltBytes),
    verifier,
    createdAt: new Date().toISOString(),
  };
  writeMeta(meta);
  await putMasterKey(key);
  currentKey = key;
  currentMeta = meta;
  return meta;
}

export async function unlockWithPassword(password) {
  const meta = readMeta();
  if (!meta) throw new Error('Nenhuma conta neste dispositivo.');
  const saltBytes = fromB64(meta.salt);
  const key = await deriveKey(password, saltBytes);
  const ok = await checkVerifier(key, meta.verifier);
  if (!ok) throw new Error('Senha incorreta.');
  await putMasterKey(key);
  currentKey = key;
  currentMeta = meta;
  return meta;
}

export async function tryAutoUnlock() {
  const meta = readMeta();
  if (!meta) return null;
  const key = await getMasterKey();
  if (!key) return null;
  currentKey = key;
  currentMeta = meta;
  return meta;
}

export async function changePassword(oldPwd, newPwd, currentData) {
  const meta = readMeta();
  if (!meta) throw new Error('Sem conta.');
  if (!currentData) throw new Error('Dados não carregados.');
  const oldKey = await deriveKey(oldPwd, fromB64(meta.salt));
  const ok = await checkVerifier(oldKey, meta.verifier);
  if (!ok) throw new Error('Senha atual incorreta.');

  const newSaltBytes = randomBytes(16);
  const newKey = await deriveKey(newPwd, newSaltBytes);
  const newVerifier = await makeVerifier(newKey);

  // Ordem importante pra atomicidade: re-cifra o blob ANTES de trocar a chave em memória
  // e o meta no disco. Se algo falhar no meio, o blob antigo continua decifrável.
  const newBlob = await encryptJSON(newKey, currentData);
  localStorage.setItem('myco:data', JSON.stringify(newBlob));

  const newMeta = {
    ...meta,
    salt: toB64(newSaltBytes),
    verifier: newVerifier,
  };
  writeMeta(newMeta);
  await putMasterKey(newKey);
  currentKey = newKey;
  currentMeta = newMeta;
}

export async function lockNow() {
  await clearMasterKey();
  currentKey = null;
}

export async function wipeAuthAndData() {
  console.warn('[myco] wipeAuthAndData() chamado em', new Date().toISOString());
  try {
    localStorage.setItem('myco:wipedAt', new Date().toISOString());
  } catch { /* storage cheio, ignora */ }
  await clearMasterKey();
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('myco:data');
  currentKey = null;
  currentMeta = null;
}
