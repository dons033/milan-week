// Minimal client-side ICS builder. No server round-trip; everything runs in the browser
// from the events the user already has + their localStorage picks.
import type { EventRow } from './types';

const PRODID = '-//Milan Week//Milan Design Week 2026//EN';
const CALNAME = 'Milan Week — my picks';
const TZ = 'Europe/Rome';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function nowStamp(): string {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function dateOnly(iso: string): string {
  return iso.replace(/-/g, '');
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return (
    dt.getUTCFullYear().toString() +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate())
  );
}

function parseTime(s: string | null): { hh: number; mm: number } | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) return { hh, mm };
  }
  return null;
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push(i === 0 ? line.slice(i, i + 75) : ' ' + line.slice(i, i + 74));
    i = out[out.length - 1].startsWith(' ') ? i + 74 : i + 75;
  }
  return out.join('\r\n');
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function vevent(e: EventRow, stamp: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@milanweek`);
  lines.push(`DTSTAMP:${stamp}`);

  const start = parseTime(e.starts_time);
  const end = parseTime(e.ends_time);

  if (start) {
    const dateStr = dateOnly(e.starts_on);
    lines.push(`DTSTART;TZID=${TZ}:${dateStr}T${pad(start.hh)}${pad(start.mm)}00`);
    if (end) {
      const endDate = dateOnly(e.ends_on || e.starts_on);
      lines.push(`DTEND;TZID=${TZ}:${endDate}T${pad(end.hh)}${pad(end.mm)}00`);
    } else {
      const endHH = (start.hh + 2) % 24;
      const dayShift = start.hh + 2 >= 24 ? 1 : 0;
      const endIso = dayShift === 0 ? dateStr : nextDay(e.starts_on);
      lines.push(`DTEND;TZID=${TZ}:${endIso}T${pad(endHH)}${pad(start.mm)}00`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.starts_on)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(e.ends_on || e.starts_on)}`);
  }

  lines.push(fold(`SUMMARY:${esc(e.title)}`));

  const locParts = [e.venue, e.address].filter(Boolean).join(' \u00b7 ');
  if (locParts) lines.push(fold(`LOCATION:${esc(locParts)}`));

  const descParts: string[] = [];
  if (e.host) descParts.push(`Host: ${e.host}`);
  if (e.notes) descParts.push(e.notes);
  if (e.rsvp) descParts.push(`RSVP: ${e.rsvp}`);
  if (descParts.length) lines.push(fold(`DESCRIPTION:${esc(descParts.join('\n\n'))}`));

  if (e.lat != null && e.lng != null) {
    lines.push(`GEO:${e.lat.toFixed(6)};${e.lng.toFixed(6)}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

export function buildIcs(events: EventRow[], calName = CALNAME): string {
  const stamp = nowStamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    `NAME:${calName}`,
    `X-WR-CALNAME:${calName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${TZ}`,
  ];
  for (const e of events) lines.push(...vevent(e, stamp));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(ics: string, filename: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
