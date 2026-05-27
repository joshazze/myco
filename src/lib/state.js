import { persistEncrypted } from './storage.js';
import { padSeq } from './format.js';

const state = {
  data: null,
  meta: null,
  listeners: new Set(),
};

export function getState() {
  return state;
}

export function hasData() {
  return !!state.data;
}

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify() {
  for (const fn of state.listeners) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

export function setSession(data, meta) {
  // Backfill any new top-level fields added after the user's blob was created.
  data.pots          ||= [];
  data.sectors       ||= [];
  data.fertilizations ||= [];
  data.compostLots   ||= [];
  if (typeof data._nextPotSeq !== 'number') data._nextPotSeq = nextSeqFromPots(data.pots);
  data.settings      ||= { lastBackupISO: null, createdAt: new Date().toISOString() };
  for (const lot of data.compostLots) lot.harvests ||= [];
  state.data = data;
  state.meta = meta;
  notify();
}

function nextSeqFromPots(pots) {
  let max = 0;
  for (const p of pots) {
    const n = parseInt((p.displayId || '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export function clearSession() {
  state.data = null;
  state.meta = null;
  notify();
}

export async function mutate(fn) {
  if (!state.data) throw new Error('Sem dados em memória.');
  fn(state.data);
  await persistEncrypted(state.data);
  notify();
}

export function uid() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
}

/* =================================================================
   Domain: Sectors
   ================================================================ */

const DEFAULT_INTERVALS = { liquid: 7, solid: 30, bicarbonate: 15 };

export async function addSector({ name, description, intervals }) {
  const sector = {
    id: uid(),
    name: (name || '').trim(),
    description: (description || '').trim(),
    intervals: {
      liquid: clampInt(intervals?.liquid, DEFAULT_INTERVALS.liquid),
      solid: clampInt(intervals?.solid, DEFAULT_INTERVALS.solid),
      bicarbonate: clampInt(intervals?.bicarbonate, DEFAULT_INTERVALS.bicarbonate),
    },
    createdAt: nowISO(),
  };
  await mutate((d) => { d.sectors.push(sector); });
  return sector;
}

export async function updateSector(id, patch) {
  await mutate((d) => {
    const s = d.sectors.find((x) => x.id === id);
    if (!s) return;
    if ('name' in patch) s.name = (patch.name || '').trim();
    if ('description' in patch) s.description = (patch.description || '').trim();
    if ('intervals' in patch) {
      s.intervals = {
        liquid: clampInt(patch.intervals.liquid, s.intervals.liquid),
        solid: clampInt(patch.intervals.solid, s.intervals.solid),
        bicarbonate: clampInt(patch.intervals.bicarbonate, s.intervals.bicarbonate),
      };
    }
  });
}

export async function deleteSector(id) {
  await mutate((d) => {
    d.sectors = d.sectors.filter((s) => s.id !== id);
    for (const p of d.pots) if (p.sectorId === id) p.sectorId = null;
  });
}

function clampInt(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
}

/* =================================================================
   Domain: Pots (pokédex)
   ================================================================ */

export async function addPot({ name, species, plantedISO, description, photo, sectorId }) {
  let pot;
  await mutate((d) => {
    const seq = d._nextPotSeq || 1;
    pot = {
      id: uid(),
      displayId: `#${padSeq(seq)}`,
      name: (name || '').trim() || 'Sem nome',
      species: (species || '').trim(),
      plantedISO: plantedISO || null,
      description: (description || '').trim(),
      photo: photo || null,
      sectorId: sectorId || null,
      createdAt: nowISO(),
    };
    d.pots.push(pot);
    d._nextPotSeq = seq + 1;
  });
  return pot;
}

export async function updatePot(id, patch) {
  await mutate((d) => {
    const p = d.pots.find((x) => x.id === id);
    if (!p) return;
    if ('name' in patch) p.name = (patch.name || '').trim() || 'Sem nome';
    if ('species' in patch) p.species = (patch.species || '').trim();
    if ('plantedISO' in patch) p.plantedISO = patch.plantedISO || null;
    if ('description' in patch) p.description = (patch.description || '').trim();
    if ('photo' in patch) p.photo = patch.photo || null;
    if ('sectorId' in patch) p.sectorId = patch.sectorId || null;
  });
}

export async function deletePot(id) {
  await mutate((d) => {
    d.pots = d.pots.filter((p) => p.id !== id);
    d.fertilizations = d.fertilizations.filter((f) => f.potId !== id);
  });
}

/* =================================================================
   Domain: Fertilizations
   ================================================================ */

export const FERT_TYPES = {
  liquid:      { key: 'liquid',      label: 'Líquido',         shortLabel: 'líquido',     icon: 'droplet' },
  solid:       { key: 'solid',       label: 'Sólido',          shortLabel: 'sólido',      icon: 'beaker' },
  bicarbonate: { key: 'bicarbonate', label: 'Rega alcalina',   shortLabel: 'bicarbonato', icon: 'sparkle' },
};

export async function addFertilization({ type, potId, dateISO, dose, notes, photo }) {
  if (!FERT_TYPES[type]) throw new Error('Tipo de adubo inválido.');
  let entry;
  await mutate((d) => {
    entry = {
      id: uid(),
      type,
      potId: potId || null,
      dateISO: dateISO || nowISO(),
      dose: (dose || '').trim(),
      notes: (notes || '').trim(),
      photo: photo || null,
      createdAt: nowISO(),
    };
    d.fertilizations.push(entry);
  });
  return entry;
}

export async function bulkFertilizeSector({ sectorId, type, dateISO, dose, notes }) {
  if (!FERT_TYPES[type]) throw new Error('Tipo de adubo inválido.');
  const created = [];
  await mutate((d) => {
    const targets = d.pots.filter((p) => p.sectorId === sectorId);
    for (const p of targets) {
      const entry = {
        id: uid(),
        type,
        potId: p.id,
        dateISO: dateISO || nowISO(),
        dose: (dose || '').trim(),
        notes: (notes || '').trim(),
        photo: null,
        createdAt: nowISO(),
      };
      d.fertilizations.push(entry);
      created.push(entry);
    }
  });
  return created;
}

export async function deleteFertilization(id) {
  await mutate((d) => {
    d.fertilizations = d.fertilizations.filter((f) => f.id !== id);
  });
}

/* =================================================================
   Domain: Compost Lots
   ================================================================ */

export async function startLot({ boxNumber, startedISO, notes }) {
  const n = Number(boxNumber);
  if (![1, 2, 3, 4].includes(n)) throw new Error('Caixa inválida (1–4).');
  let lot;
  await mutate((d) => {
    lot = {
      id: uid(),
      boxNumber: n,
      startedISO: startedISO || nowISO(),
      completedISO: null,
      emptiedISO: null,
      notes: (notes || '').trim(),
      destination: '',
      harvests: [],
      createdAt: nowISO(),
    };
    d.compostLots.push(lot);
  });
  return lot;
}

export async function updateLotNotes(id, notes) {
  await mutate((d) => {
    const l = d.compostLots.find((x) => x.id === id);
    if (!l) return;
    l.notes = (notes || '').trim();
  });
}

export async function completeLot(id, completedISO) {
  await mutate((d) => {
    const l = d.compostLots.find((x) => x.id === id);
    if (!l) return;
    l.completedISO = completedISO || nowISO();
  });
}

export async function emptyLot(id, { emptiedISO, destination }) {
  await mutate((d) => {
    const l = d.compostLots.find((x) => x.id === id);
    if (!l) return;
    l.emptiedISO = emptiedISO || nowISO();
    l.destination = (destination || '').trim();
    if (!l.completedISO) l.completedISO = l.emptiedISO;
  });
}

export async function deleteLot(id) {
  await mutate((d) => {
    d.compostLots = d.compostLots.filter((l) => l.id !== id);
  });
}

export const HARVEST_INTERVAL_DAYS = 30;

export async function addHarvest(lotId, { dateISO, quantity, notes }) {
  let harvest;
  await mutate((d) => {
    const l = d.compostLots.find((x) => x.id === lotId);
    if (!l) return;
    l.harvests ||= [];
    harvest = {
      id: uid(),
      dateISO: dateISO || nowISO(),
      quantity: (quantity || '').trim(),
      notes: (notes || '').trim(),
      createdAt: nowISO(),
    };
    l.harvests.push(harvest);
  });
  return harvest;
}

export async function deleteHarvest(lotId, harvestId) {
  await mutate((d) => {
    const l = d.compostLots.find((x) => x.id === lotId);
    if (!l || !l.harvests) return;
    l.harvests = l.harvests.filter((h) => h.id !== harvestId);
  });
}

export function selectHarvestsForLot(lotId) {
  if (!state.data) return [];
  const lot = state.data.compostLots.find((l) => l.id === lotId);
  if (!lot || !lot.harvests) return [];
  return [...lot.harvests].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function selectLastHarvestForBox(boxNumber) {
  if (!state.data) return null;
  let latest = null;
  for (const lot of state.data.compostLots) {
    if (lot.boxNumber !== boxNumber) continue;
    for (const h of lot.harvests || []) {
      if (!latest || h.dateISO > latest.dateISO) latest = h;
    }
  }
  return latest;
}

/* =================================================================
   Selectors / derived state
   ================================================================ */

export function selectActiveLot(boxNumber) {
  if (!state.data) return null;
  return state.data.compostLots
    .filter((l) => l.boxNumber === boxNumber && !l.emptiedISO)
    .sort((a, b) => b.startedISO.localeCompare(a.startedISO))[0] || null;
}

export function selectLotsForBox(boxNumber) {
  if (!state.data) return [];
  return state.data.compostLots
    .filter((l) => l.boxNumber === boxNumber)
    .sort((a, b) => b.startedISO.localeCompare(a.startedISO));
}

export function selectPotsInSector(sectorId) {
  if (!state.data) return [];
  return state.data.pots.filter((p) => p.sectorId === sectorId);
}

export function selectFertsForPot(potId) {
  if (!state.data) return [];
  return state.data.fertilizations
    .filter((f) => f.potId === potId)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function selectFertsForSector(sectorId) {
  if (!state.data) return [];
  const potIds = new Set(state.data.pots.filter((p) => p.sectorId === sectorId).map((p) => p.id));
  return state.data.fertilizations
    .filter((f) => potIds.has(f.potId))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function selectLastFertForSector(sectorId, type) {
  const list = selectFertsForSector(sectorId).filter((f) => f.type === type);
  return list[0] || null;
}

export function selectSectorStatus(sectorId) {
  const sector = state.data?.sectors.find((s) => s.id === sectorId);
  if (!sector) return null;
  const now = Date.now();
  const types = ['liquid', 'solid', 'bicarbonate'];
  const result = {};
  for (const t of types) {
    const last = selectLastFertForSector(sectorId, t);
    const intervalDays = sector.intervals[t];
    if (!last) {
      result[t] = { lastISO: null, daysSince: null, overdue: false, dueInDays: null };
    } else {
      const daysSince = Math.floor((now - new Date(last.dateISO).getTime()) / 86400000);
      const dueInDays = intervalDays - daysSince;
      result[t] = {
        lastISO: last.dateISO,
        daysSince,
        overdue: daysSince > intervalDays,
        dueInDays,
      };
    }
  }
  return result;
}
