const DATE_LONG = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const DATE_FULL = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

export const fmtTime = (iso) => TIME.format(new Date(iso));
export const fmtDateLong = (iso) => DATE_LONG.format(new Date(iso));
export const fmtDateFull = (iso) => DATE_FULL.format(new Date(iso));
export const fmtMonthYear = (d) => MONTH_YEAR.format(d);
export const fmtMonthShort = (d) => MONTH_SHORT.format(d);

const DOW_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOW_LONG  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

export function fmtCompactDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(d) - dayStart(now)) / 86400000);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  if (diff === 0) return `hoje · ${dd}/${mm}`;
  if (diff === 1) return `amanhã · ${dd}/${mm}`;
  if (diff === -1) return `ontem · ${dd}/${mm}`;
  if (diff > 1 && diff < 7) return `${DOW_LONG[d.getDay()].toLowerCase()} · ${dd}/${mm}`;
  if (diff < -1 && diff > -7) return `${DOW_LONG[d.getDay()].toLowerCase()} passado · ${dd}/${mm}`;
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function fmtDateRelative(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(d) - dayStart(now)) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';
  if (diffDays > 1 && diffDays < 7) return DOW_LONG[d.getDay()];
  if (diffDays < -1 && diffDays > -7) return `${DOW_LONG[d.getDay()]} passado`;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${DOW_SHORT[d.getDay()]} ${dd}/${mm}`;
}

export function fmtDaysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  if (diffDays > 1) return `há ${diffDays} dias`;
  if (diffDays === -1) return 'amanhã';
  return `em ${Math.abs(diffDays)} dias`;
}

export function daysBetween(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.round((b - a) / 86400000);
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toDateLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export function fromDateLocal(value) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
}

export function padSeq(n) {
  return String(n).padStart(3, '0');
}
