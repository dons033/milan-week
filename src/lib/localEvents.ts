// User's own events, stored only in the browser. Merged into the public
// list at read time. Same shape as EventRow with source: 'local' so all
// existing filtering / sorting / map logic works unchanged.
import type { EventRow } from './types';

const KEY = 'milanweek.localEvents.v1';

export type LocalEventInput = {
  title: string;
  starts_on: string;
  ends_on?: string | null;
  starts_time?: string | null;
  ends_time?: string | null;
  venue?: string | null;
  address?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function read(): EventRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: EventRow[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function newId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `local-${rand}`;
}

function hydrate(input: LocalEventInput, existing?: EventRow): EventRow {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? newId(),
    starts_on: input.starts_on,
    ends_on: input.ends_on ?? null,
    starts_time: input.starts_time ?? null,
    ends_time: input.ends_time ?? null,
    title: input.title,
    host: null,
    venue: input.venue ?? null,
    address: input.address ?? null,
    phase: null,
    notes: input.notes ?? null,
    rsvp: null,
    source: 'local',
    links: [],
    status: null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    sort_order: 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function loadLocalEvents(): EventRow[] {
  return read();
}

export function addLocalEvent(input: LocalEventInput): EventRow {
  const row = hydrate(input);
  const rows = read();
  rows.push(row);
  write(rows);
  return row;
}

export function updateLocalEvent(id: string, input: LocalEventInput): EventRow | null {
  const rows = read();
  const idx = rows.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated = hydrate(input, rows[idx]);
  rows[idx] = updated;
  write(rows);
  return updated;
}

export function deleteLocalEvent(id: string) {
  const rows = read().filter((e) => e.id !== id);
  write(rows);
}

export function isLocal(e: EventRow): boolean {
  return e.source === 'local' || e.id.startsWith('local-');
}

export function exportJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function importJson(raw: string, mode: 'replace' | 'merge' = 'merge'): number {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of events');
  const existing = mode === 'replace' ? [] : read();
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const row of parsed) {
    if (!row || typeof row !== 'object' || !row.title || !row.starts_on) continue;
    const id = typeof row.id === 'string' && row.id.startsWith('local-') ? row.id : newId();
    byId.set(id, { ...row, id, source: 'local' });
  }
  const out = Array.from(byId.values());
  write(out);
  return out.length;
}

export function clearLocalEvents() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
