import type { EventRow } from './types';

export function shortSource(source: string | null): string | null {
  if (!source) return null;
  // "Galerie / Novità / Designboom / Wallpaper" → "Galerie"
  // "Dezeen / Domus" → "Dezeen"
  // "P:S" → "P:S"
  // "The Future Perfect guide" → "The Future Perfect"
  const first = source.split(/\s*[/·]\s*/)[0].trim();
  return first.replace(/\s+(guide|newsletter)$/i, '') || null;
}

export function matchesQuery(e: EventRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [e.title, e.host, e.venue, e.address, e.notes, e.phase, e.source]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDayHeading(iso: string) {
  const dt = parseISODate(iso);
  const dow = DAY_NAMES[dt.getUTCDay()];
  const day = dt.getUTCDate();
  const month = MONTH_NAMES[dt.getUTCMonth()];
  return `${dow} ${day} ${month}`;
}

export function formatDateShort(iso: string) {
  const dt = parseISODate(iso);
  return `${dt.getUTCDate()} ${MONTH_NAMES[dt.getUTCMonth()]}`;
}

export function eventTimeLabel(e: Pick<EventRow, 'starts_time' | 'ends_time'>) {
  const s = (e.starts_time || '').trim();
  const end = (e.ends_time || '').trim();
  if (!s && !end) return '—';
  if (s && end && end !== '—') return `${s} → ${end}`;
  if (s) return s;
  return end;
}

export function timeSortKey(s: string | null | undefined): number {
  if (!s) return 9999;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const t = s.toLowerCase();
  if (t.includes('all day')) return -1;
  if (t.includes('morning')) return 8 * 60;
  if (t.includes('evening') || t.includes('night')) return 19 * 60;
  return 9999;
}

export function expandEventDays(iso_from: string, iso_to: string | null): string[] {
  if (!iso_to || iso_to === iso_from) return [iso_from];
  const a = parseISODate(iso_from);
  const b = parseISODate(iso_to);
  const out: string[] = [];
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export function mapsUrl(address: string | null | undefined) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', Milano')}`;
}

export function directionsUrl(
  destination: string | null | undefined,
  opts?: { origin?: string; destLat?: number | null; destLng?: number | null },
) {
  if (!destination && opts?.destLat == null) return null;
  const dest =
    opts?.destLat != null && opts?.destLng != null
      ? `${opts.destLat},${opts.destLng}`
      : `${destination}, Milano`;
  const params = new URLSearchParams({ api: '1', destination: dest });
  if (opts?.origin) params.set('origin', opts.origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
