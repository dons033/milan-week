import type { EventRow } from './types';

// Subtle dot colour per phase, used as a visual cue on the event card's time column.
export const PHASE_COLOR: Record<string, string> = {
  'Pre-Fair':     '#94a3b8',  // slate
  'Fuorisalone':  '#d97706',  // amber
  'Alcova':       '#0d9488',  // teal
  'At Fair (Rho)': '#2563eb', // blue
};

export function phaseColor(phase: string | null): string {
  return (phase && PHASE_COLOR[phase]) || '#cbd5e1';
}

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

/**
 * Return a best-effort [startMin, endMin] from a starts_time/ends_time pair.
 * Handles HH:MM numerics plus vague labels (Morning, Afternoon, Evening, All day).
 * Returns null when the time is genuinely unknowable (by appointment, null).
 */
function timeWindow(e: Pick<EventRow, 'starts_time' | 'ends_time'>): [number, number] | null {
  const s = (e.starts_time || '').trim().toLowerCase();
  const en = (e.ends_time || '').trim().toLowerCase();

  function toMin(raw: string): number | null {
    if (!raw) return null;
    const hh = /^(\d{1,2}):(\d{2})/.exec(raw);
    if (hh) {
      const h = parseInt(hh[1], 10);
      const m = parseInt(hh[2], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
    }
    if (raw.includes('all day')) return 0;
    if (raw.includes('morning')) return 8 * 60;
    if (raw.includes('afternoon')) return 12 * 60;
    if (raw.includes('evening') || raw.includes('night')) return 18 * 60;
    return null;
  }

  function endToMin(raw: string): number | null {
    if (!raw || raw === '\u2014' || raw === '-') return null;
    const t = toMin(raw);
    if (t != null) return t;
    if (raw.includes('all day')) return 23 * 60 + 59;
    if (raw.includes('morning')) return 12 * 60;
    if (raw.includes('afternoon')) return 18 * 60;
    if (raw.includes('evening') || raw.includes('night')) return 23 * 60;
    return null;
  }

  // Treat genuinely-unknown (by-appointment, null) as null — they can't be classified.
  if (s.includes('appointment') || s.includes('request') || s.includes('tbc')) return null;
  if (!s && !en) return null;

  const startMin = toMin(s);
  let endMin = endToMin(en);

  // Filled-in defaults: if we know start but not end, give it 2h; if only end known, start 2h before.
  if (startMin != null && endMin == null) endMin = Math.min(startMin + 120, 23 * 60 + 59);
  if (startMin == null && endMin != null) return [Math.max(0, endMin - 120), endMin];
  if (startMin != null && endMin != null) {
    // If end sorts before start (bad data), clamp
    if (endMin < startMin) endMin = 23 * 60 + 59;
    return [startMin, endMin];
  }
  return null;
}

export type LiveStatus =
  | 'open'            // happening right now
  | 'upcoming-today'  // starts later today
  | 'past'            // already ended today
  | 'future'          // a different day, in the future
  | 'unknown';        // can't tell (bad time data)

/**
 * Classify an event against a reference time (defaults to now in Europe/Rome).
 * Used for the Today / Now filters and the 'open now' chip.
 */
export function liveStatus(
  e: Pick<EventRow, 'starts_on' | 'ends_on' | 'starts_time' | 'ends_time'>,
  ref?: { today: string; nowMin: number },
): LiveStatus {
  const today = ref?.today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const nowMin =
    ref?.nowMin ??
    (() => {
      const t = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Europe/Rome',
        hour12: false,
      });
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    })();

  const startsOn = e.starts_on;
  const endsOn = e.ends_on || e.starts_on;

  if (today < startsOn) return 'future';
  if (today > endsOn) return 'past';
  // today is within [startsOn, endsOn]

  const w = timeWindow(e);
  if (!w) return 'unknown';
  const [startMin, endMin] = w;

  // For multi-day events, assume the time window repeats each day.
  if (nowMin < startMin) return 'upcoming-today';
  if (nowMin <= endMin) return 'open';
  return 'past';
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
