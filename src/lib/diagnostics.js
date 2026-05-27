// Instrumentação leve pra reconstituir timeline quando algo der errado.
// Tudo localStorage — sobrevive recargas, mas não sobrevive um wipe geral do storage.

const BOOT_LOG_KEY = 'myco:bootLog';
const LAST_BOOT_KEY = 'myco:lastBoot';
const MAX_ENTRIES = 30;

export function recordBoot() {
  try {
    const entry = {
      at: new Date().toISOString(),
      hasAuth: !!localStorage.getItem('myco:auth'),
      hasData: !!localStorage.getItem('myco:data'),
      standalone: typeof window !== 'undefined'
        && window.matchMedia?.('(display-mode: standalone)').matches === true,
      ua: navigator.userAgent.slice(0, 120),
    };
    localStorage.setItem(LAST_BOOT_KEY, entry.at);
    const raw = localStorage.getItem(BOOT_LOG_KEY);
    const log = raw ? safeParse(raw) : [];
    log.push(entry);
    while (log.length > MAX_ENTRIES) log.shift();
    localStorage.setItem(BOOT_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.warn('[myco] recordBoot falhou:', e);
  }
}

export function readBootLog() {
  try {
    const raw = localStorage.getItem(BOOT_LOG_KEY);
    return raw ? safeParse(raw) : [];
  } catch {
    return [];
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return []; }
}
