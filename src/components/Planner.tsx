'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { EventRow, Pick } from '@/lib/types';
import {
  formatDayHeading,
  formatDateShort,
  eventTimeLabel,
  timeSortKey,
  expandEventDays,
  mapsUrl,
  directionsUrl,
  shortSource,
  matchesQuery,
  liveStatus,
} from '@/lib/format';
import { loadPicks, setPick as persistPick } from '@/lib/picks';
import { buildIcs, downloadIcs, slug } from '@/lib/ics';

type Props = { initialEvents: EventRow[] };

type PickFilter = 'all' | 'going' | 'maybe' | 'multiday' | 'today' | 'now';

function passesPickFilter(
  e: EventRow,
  dayIso: string,
  picks: Record<string, Pick>,
  filter: PickFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'multiday') return !!e.ends_on && e.ends_on !== e.starts_on;
  if (filter === 'today' || filter === 'now') {
    // Use today's Milan date for the reference, not the rendered day group
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
    if (dayIso !== today) return false;
    const status = liveStatus(e);
    if (status === 'past' || status === 'future' || status === 'unknown') return false;
    if (filter === 'today') return status === 'open' || status === 'upcoming-today';
    // 'now': open right now, OR starting within the next hour
    if (status === 'open') return true;
    // upcoming-today within 60min: re-parse start time ourselves here
    const s = (e.starts_time || '').trim();
    const hh = /^(\d{1,2}):(\d{2})/.exec(s);
    if (!hh) return false;
    const startMin = parseInt(hh[1], 10) * 60 + parseInt(hh[2], 10);
    const now = new Date();
    const nowMin =
      parseInt(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour12: false }).slice(11, 13)) * 60 +
      parseInt(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour12: false }).slice(14, 16));
    return startMin - nowMin <= 60;
  }
  return picks[e.id] === filter;
}

type DayGroup = { date: string; items: EventRow[] };

function groupByDay(events: EventRow[]): DayGroup[] {
  const map = new Map<string, EventRow[]>();
  for (const e of events) {
    for (const d of expandEventDays(e.starts_on, e.ends_on)) {
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
  }
  return Array.from(map.keys())
    .sort()
    .map((date) => ({
      date,
      items: (map.get(date) || []).sort(
        (a, b) => timeSortKey(a.starts_time) - timeSortKey(b.starts_time),
      ),
    }));
}

export default function Planner({ initialEvents }: Props) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [pickFilter, setPickFilter] = useState<
    'all' | 'going' | 'maybe' | 'multiday' | 'today' | 'now'
  >('all');
  const [query, setQuery] = useState('');
  const didScroll = useRef(false);

  useEffect(() => {
    setPicks(loadPicks());
  }, []);

  const groups = useMemo(() => groupByDay(initialEvents), [initialEvents]);

  useEffect(() => {
    if (didScroll.current || groups.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const target =
      groups.find((g) => g.date >= today)?.date ??
      groups[groups.length - 1]?.date;
    if (!target) return;
    const el = document.getElementById(`d${target}`);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    didScroll.current = true;
  }, [groups]);

  function togglePick(id: string, p: Pick) {
    const current = picks[id];
    const next = current === p ? null : p;
    persistPick(id, next);
    setPicks((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  if (initialEvents.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Milan Week</h1>
          <p className="text-stone-500 text-sm mt-1">Milan Design Week — public event planner</p>
        </header>
        <div className="border border-stone-200 rounded-lg p-6 text-sm text-stone-600 bg-white">
          No events yet. Check back shortly.
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Milan Week</h1>
          <p className="text-stone-500 text-sm mt-1">
            {initialEvents.length} events · Milan Design Week 2026
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {Object.keys(picks).filter((id) => picks[id] === 'going').length > 0 && (
            <button
              onClick={() => {
                const goingIds = Object.keys(picks).filter((id) => picks[id] === 'going');
                const rows = initialEvents.filter((e) => goingIds.includes(e.id));
                downloadIcs(buildIcs(rows), 'milan-week-my-picks.ics');
              }}
              className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-emerald-100"
              title="Download your going events as an .ics file"
            >
              ⬇ My picks
            </button>
          )}
          <Link
            href="/map"
            className="border border-stone-300 rounded-full px-4 py-1.5 text-sm font-medium hover:bg-white"
          >
            Map
          </Link>
          <Link
            href="/about"
            className="text-stone-500 hover:text-stone-900 text-sm"
          >
            About
          </Link>
        </div>
      </header>

      <nav className="sticky top-0 bg-stone-50/90 backdrop-blur py-2 -mx-6 px-6 z-10 border-b border-stone-200 mb-8 space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search title, host, venue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm bg-white border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder:text-stone-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-stone-500 hover:text-stone-900"
              title="Clear search"
            >
              clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setActiveDay(null)}
            className={`text-xs px-3 py-1 rounded-full border ${
              activeDay === null
                ? 'bg-stone-900 text-white border-stone-900'
                : 'border-stone-300 text-stone-600 hover:bg-white'
            }`}
          >
            All
          </button>
          {groups.map((g) => (
            <a
              key={g.date}
              href={`#d${g.date}`}
              onClick={() => setActiveDay(g.date)}
              className={`text-xs px-3 py-1 rounded-full border ${
                activeDay === g.date
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'border-stone-300 text-stone-600 hover:bg-white'
              }`}
            >
              {formatDateShort(g.date)}{' '}
              <span className={activeDay === g.date ? 'opacity-60' : 'text-stone-400'}>
                · {g.items.length}
              </span>
            </a>
          ))}
        </div>
        <div className="flex gap-1.5 items-center text-[10px] uppercase tracking-wider text-stone-400">
          Show:
          {(['all', 'now', 'today', 'going', 'maybe', 'multiday'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setPickFilter(k)}
              className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${
                pickFilter === k
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'border-stone-300 text-stone-600 hover:bg-white'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </nav>

      {(() => {
        const anyMatch = groups.some((g) =>
          (!activeDay || g.date === activeDay) &&
          g.items.some((e) => passesPickFilter(e, g.date, picks, pickFilter) && matchesQuery(e, query)),
        );
        if (!anyMatch) {
          const msg =
            pickFilter === 'today'
              ? 'No events still open today.'
              : pickFilter === 'now'
              ? 'No events open now or starting within the hour.'
              : query
              ? `No events match "${query}".`
              : pickFilter !== 'all'
              ? `No events marked ${pickFilter}.`
              : 'No events to show.';
          return <div className="text-sm text-stone-500 py-16 text-center">{msg}</div>;
        }
        return null;
      })()}

      <div className="space-y-12">
        {groups
          .filter((g) => !activeDay || g.date === activeDay)
          .map((g) => {
            const items = g.items.filter((e) => {
              if (!matchesQuery(e, query)) return false;
              return passesPickFilter(e, g.date, picks, pickFilter);
            });
            if (items.length === 0) return null;
            return (
              <section key={g.date} id={`d${g.date}`}>
                <h2 className="text-xs uppercase tracking-widest text-stone-500 mb-4 border-b border-stone-200 pb-2">
                  {formatDayHeading(g.date)}
                </h2>
                <ul className="divide-y divide-stone-200">
                  {items.map((e) => {
                    const pick = picks[e.id] || null;
                    return (
                      <li
                        key={`${g.date}-${e.id}`}
                        className={`py-5 ${pick === 'skip' ? 'opacity-40' : ''}`}
                      >
                        <EventCard
                          e={e}
                          dayIso={g.date}
                          pick={pick}
                          onTogglePick={(p) => togglePick(e.id, p)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>

      <footer className="mt-16 pt-8 border-t border-stone-200 text-xs text-stone-400">
        Data compiled from public listings. Picks stored locally in your browser.
      </footer>
    </main>
  );
}

function EventCard({
  e,
  dayIso,
  pick,
  onTogglePick,
}: {
  e: EventRow;
  dayIso: string;
  pick: Pick | null;
  onTogglePick: (p: Pick) => void;
}) {
  const time = eventTimeLabel(e);
  const multiDay = e.ends_on && e.ends_on !== e.starts_on;
  const map = mapsUrl(e.address);
  const directions = directionsUrl(e.address, { destLat: e.lat, destLng: e.lng });
  const isConfirmed = (e.status || '').toUpperCase().includes('CONFIRMED');
  const sourceLabel = shortSource(e.source);

  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-24 text-sm text-stone-900 tabular-nums pt-0.5">
        <div className="font-medium">{time}</div>
        {multiDay && dayIso === e.starts_on && (
          <div className="text-[10px] uppercase tracking-wider text-stone-400 mt-0.5">
            → {formatDateShort(e.ends_on!)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="min-w-0">
          <h3 className="font-medium text-stone-900 leading-snug">
            <Link href={`/event/${e.id}`} className="hover:underline decoration-stone-300 underline-offset-2">
              {e.title}
            </Link>
            {isConfirmed && (
              <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 align-middle">
                Confirmed
              </span>
            )}
            {e.phase && (
              <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 align-middle">
                {e.phase}
              </span>
            )}
            {sourceLabel && (
              <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 align-middle">
                {sourceLabel}
              </span>
            )}
          </h3>
          {e.host && <p className="text-sm text-stone-500 mt-0.5">{e.host}</p>}
        </div>

        {(e.venue || e.address) && (
          <p className="text-sm text-stone-600 mt-1.5">
            {e.venue}
            {e.venue && e.address && <span className="text-stone-400"> · </span>}
            {map ? (
              <a
                href={map}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-stone-300 underline-offset-2 hover:decoration-stone-700"
              >
                {e.address}
              </a>
            ) : (
              e.address
            )}
          </p>
        )}

        {e.notes && <p className="text-sm text-stone-500 mt-2 leading-relaxed">{e.notes}</p>}

        {e.rsvp && (
          <p className="text-xs text-stone-500 mt-2 italic">⚑ {e.rsvp}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3 items-center">
          {(['going', 'maybe', 'skip'] as const).map((p) => {
            const active = pick === p;
            const styles: Record<typeof p, string> = {
              going: active
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
              maybe: active
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-amber-300 text-amber-700 hover:bg-amber-50',
              skip: active
                ? 'bg-stone-500 text-white border-stone-500'
                : 'border-stone-300 text-stone-500 hover:bg-stone-100',
            };
            return (
              <button
                key={p}
                onClick={() => onTogglePick(p)}
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[p]}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 mt-2 text-xs items-center">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 underline-offset-2"
            >
              Directions
            </a>
          )}
          <button
            onClick={() => downloadIcs(buildIcs([e]), `${slug(e.title) || 'event'}.ics`)}
            className="text-stone-500 hover:text-stone-900"
            title="Add to calendar (.ics)"
          >
            + Calendar
          </button>
          {e.links?.slice(0, 3).map((link, i) => {
            const isFirst = i === 0;
            return (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isFirst
                    ? 'border border-stone-300 text-stone-700 hover:bg-white rounded-full px-2 py-0.5 text-[11px]'
                    : 'text-stone-500 hover:text-stone-900 text-[11px]'
                }
              >
                {link.label}
                {isFirst ? ' \u2192' : ''}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
