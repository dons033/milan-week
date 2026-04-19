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
  matchesQuery,
  liveStatus,
  phaseColor,
} from '@/lib/format';
import { loadPicks, setPick as persistPick } from '@/lib/picks';
import { buildIcs, downloadIcs, slug } from '@/lib/ics';
import { loadPrefs, type Home } from '@/lib/prefs';
import {
  loadLocalEvents,
  deleteLocalEvent,
  isLocal,
} from '@/lib/localEvents';
import LocalEventForm from './LocalEventForm';
import SettingsSheet from './SettingsSheet';

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
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
    if (dayIso !== today) return false;
    const status = liveStatus(e);
    if (status === 'past' || status === 'future' || status === 'unknown') return false;
    if (filter === 'today') return status === 'open' || status === 'upcoming-today';
    if (status === 'open') return true;
    const s = (e.starts_time || '').trim();
    const hh = /^(\d{1,2}):(\d{2})/.exec(s);
    if (!hh) return false;
    const startMin = parseInt(hh[1], 10) * 60 + parseInt(hh[2], 10);
    const now = new Date();
    const t = now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour12: false });
    const nowMin = parseInt(t.slice(11, 13)) * 60 + parseInt(t.slice(14, 16));
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

const PRIMARY_FILTERS: { key: PickFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'now', label: 'Now' },
  { key: 'today', label: 'Today' },
  { key: 'going', label: 'Going' },
];
const MORE_FILTERS: { key: PickFilter; label: string }[] = [
  { key: 'maybe', label: 'Maybe' },
  { key: 'multiday', label: 'Multi-day' },
];

export default function Planner({ initialEvents }: Props) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [localEvents, setLocalEvents] = useState<EventRow[]>([]);
  const [home, setHomeState] = useState<Home | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [pickFilter, setPickFilter] = useState<PickFilter>('all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const didScroll = useRef(false);
  const dayStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicks(loadPicks());
    setLocalEvents(loadLocalEvents());
    setHomeState(loadPrefs().home);
  }, []);

  function refreshLocalEvents() {
    setLocalEvents(loadLocalEvents());
  }

  const allEvents = useMemo(
    () => [...initialEvents, ...localEvents],
    [initialEvents, localEvents],
  );

  const groups = useMemo(() => groupByDay(allEvents), [allEvents]);
  const goingCount = useMemo(
    () => Object.values(picks).filter((p) => p === 'going').length,
    [picks],
  );

  const todayMilan = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }),
    [],
  );

  // scroll to today's section + center today in the day strip
  useEffect(() => {
    if (didScroll.current || groups.length === 0) return;
    const target = groups.find((g) => g.date >= todayMilan)?.date ?? groups[groups.length - 1]?.date;
    if (!target) return;
    requestAnimationFrame(() => {
      document.getElementById(`d${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const chip = dayStripRef.current?.querySelector<HTMLElement>(`[data-day="${target}"]`);
      chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
    didScroll.current = true;
  }, [groups, todayMilan]);

  function setPickFor(id: string, next: Pick | null) {
    persistPick(id, next);
    setPicks((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function downloadAllPicks() {
    const goingIds = Object.keys(picks).filter((id) => picks[id] === 'going');
    const rows = initialEvents.filter((e) => goingIds.includes(e.id));
    if (rows.length === 0) return;
    downloadIcs(buildIcs(rows), 'milan-week-my-picks.ics');
  }

  if (initialEvents.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Milan Week</h1>
        <p className="text-stone-500 text-sm mt-1 mb-10">Milan Design Week 2026</p>
        <div className="border border-stone-200 rounded-lg p-6 text-sm text-stone-600 bg-white">
          No events yet. Check back shortly.
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-5 pb-24">
      {/* Header — minimal */}
      <header className="flex items-center justify-between gap-4 pt-7 pb-5">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-stone-900">
          Milan Week
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch((v) => !v)}
            aria-label="Search"
            className="w-10 h-10 grid place-items-center rounded-full text-stone-600 hover:bg-stone-200/60 active:bg-stone-200 text-base"
          >
            ⌕
          </button>
          <Link
            href="/map"
            aria-label="Map"
            className="w-10 h-10 grid place-items-center rounded-full text-stone-600 hover:bg-stone-200/60 active:bg-stone-200 text-base"
          >
            ⌖
          </Link>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            className="w-10 h-10 grid place-items-center rounded-full text-stone-600 hover:bg-stone-200/60 active:bg-stone-200 text-xl leading-none"
          >
            ⋯
          </button>
        </div>
      </header>

      {/* Sticky day strip + filter row */}
      <div className="sticky top-0 z-20 -mx-5 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/80 border-b border-stone-200">
        {showSearch && (
          <div className="px-5 pt-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="search"
                placeholder="Search title, host, venue\u2026"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full text-sm bg-white border border-stone-300 rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400 placeholder:text-stone-400"
              />
              <button
                onClick={() => {
                  setQuery('');
                  setShowSearch(false);
                }}
                className="text-sm text-stone-500 hover:text-stone-900 px-2"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Day strip */}
        <div
          ref={dayStripRef}
          className="flex gap-1.5 overflow-x-auto px-5 py-3 scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none' }}
        >
          <DayChip
            isActive={activeDay === null}
            onClick={() => setActiveDay(null)}
            label="All"
          />
          {groups.map((g) => (
            <DayChip
              key={g.date}
              dataDay={g.date}
              isActive={activeDay === g.date}
              isToday={g.date === todayMilan}
              onClick={() => {
                setActiveDay(g.date);
                document.getElementById(`d${g.date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              label={formatDateShort(g.date)}
            />
          ))}
        </div>

        {/* Pick filter row */}
        <div className="flex items-center gap-1.5 px-5 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {PRIMARY_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              isActive={pickFilter === f.key}
              onClick={() => setPickFilter(f.key)}
              label={f.label}
            />
          ))}
          {MORE_FILTERS.some((f) => f.key === pickFilter) && (
            <FilterChip
              isActive
              onClick={() => setPickFilter('all')}
              label={MORE_FILTERS.find((f) => f.key === pickFilter)!.label}
            />
          )}
          <button
            onClick={() => setFiltersOpen(true)}
            className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1.5 whitespace-nowrap"
          >
            More \u25be
          </button>
        </div>
      </div>

      {/* Empty state */}
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

      <div className="space-y-10 mt-2">
        {groups
          .filter((g) => !activeDay || g.date === activeDay)
          .map((g) => {
            const items = g.items.filter((e) => {
              if (!matchesQuery(e, query)) return false;
              return passesPickFilter(e, g.date, picks, pickFilter);
            });
            if (items.length === 0) return null;
            return (
              <section key={g.date} id={`d${g.date}`} className="scroll-mt-32">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500 mb-3 mt-2">
                  {formatDayHeading(g.date)}
                  {g.date === todayMilan && (
                    <span className="ml-2 text-[10px] text-emerald-600">today</span>
                  )}
                </h2>
                <ul className="space-y-1">
                  {items.map((e) => {
                    const pick = picks[e.id] || null;
                    if (editingId === e.id) {
                      return (
                        <li key={`${g.date}-${e.id}`} className="border border-stone-300 rounded-xl p-3 -mx-3 my-2 bg-white">
                          <LocalEventForm
                            initial={e}
                            onSaved={() => {
                              refreshLocalEvents();
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </li>
                      );
                    }
                    return (
                      <EventCard
                        key={`${g.date}-${e.id}`}
                        e={e}
                        dayIso={g.date}
                        pick={pick}
                        home={home}
                        onTogglePick={(p) => setPickFor(e.id, p)}
                        onEdit={isLocal(e) ? () => setEditingId(e.id) : undefined}
                        onDelete={
                          isLocal(e)
                            ? () => {
                                if (!confirm('Delete this event from your browser?')) return;
                                deleteLocalEvent(e.id);
                                refreshLocalEvents();
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>

      <footer className="mt-16 pt-8 border-t border-stone-200 text-xs text-stone-400 text-center">
        Public listings, picks stay in your browser.
      </footer>

      {/* Floating: download all picks */}
      {goingCount > 0 && (
        <button
          onClick={downloadAllPicks}
          className="fixed bottom-5 right-5 z-30 bg-emerald-600 text-white rounded-full pl-4 pr-5 py-3 text-sm font-medium shadow-lg hover:bg-emerald-700 active:scale-95 transition flex items-center gap-2"
          aria-label="Download going events as .ics"
        >
          <span className="text-base">\u2b07</span>
          <span>{goingCount}</span>
          <span className="text-emerald-100 hidden sm:inline">to calendar</span>
        </button>
      )}

      {/* Overflow menu */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)}>
          <div className="space-y-1">
            <SheetLink href="/map" onClick={() => setMenuOpen(false)}>Map</SheetLink>
            <SheetLink href="/about" onClick={() => setMenuOpen(false)}>About</SheetLink>
            <SheetButton
              onClick={() => {
                setMenuOpen(false);
                setShowSearch(true);
              }}
            >
              Search
            </SheetButton>
            <SheetButton
              onClick={() => {
                setMenuOpen(false);
                setCreating(true);
              }}
            >
              + Add your own event
            </SheetButton>
            <SheetButton
              onClick={() => {
                setMenuOpen(false);
                setSettingsOpen(true);
              }}
            >
              Settings
            </SheetButton>
            {goingCount > 0 && (
              <SheetButton
                onClick={() => {
                  setMenuOpen(false);
                  downloadAllPicks();
                }}
              >
                Download {goingCount} going as .ics
              </SheetButton>
            )}
          </div>
        </Sheet>
      )}

      {/* Add your own event */}
      {creating && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setCreating(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:m-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold tracking-tight mb-1">Add your own event</h2>
            <p className="text-xs text-stone-500 mb-4">
              Saved in this browser only. Export as JSON from Settings to back up.
            </p>
            <LocalEventForm
              onSaved={() => {
                refreshLocalEvents();
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      )}

      {/* Settings */}
      {settingsOpen && (
        <SettingsSheet
          initialHome={home}
          localEventCount={localEvents.length}
          onHomeChange={setHomeState}
          onLocalEventsChange={refreshLocalEvents}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* More filters */}
      {filtersOpen && (
        <Sheet onClose={() => setFiltersOpen(false)} title="Filter">
          <div className="space-y-1">
            {[...PRIMARY_FILTERS, ...MORE_FILTERS].map((f) => (
              <SheetButton
                key={f.key}
                onClick={() => {
                  setPickFilter(f.key);
                  setFiltersOpen(false);
                }}
                isActive={pickFilter === f.key}
              >
                {f.label}
              </SheetButton>
            ))}
          </div>
        </Sheet>
      )}
    </main>
  );
}

function DayChip({
  isActive,
  isToday,
  onClick,
  label,
  dataDay,
}: {
  isActive: boolean;
  isToday?: boolean;
  onClick: () => void;
  label: string;
  dataDay?: string;
}) {
  return (
    <button
      data-day={dataDay}
      onClick={onClick}
      className={`shrink-0 snap-start text-[13px] px-3.5 h-9 rounded-full border whitespace-nowrap transition-colors ${
        isActive
          ? 'bg-stone-900 text-white border-stone-900'
          : isToday
          ? 'bg-white border-emerald-400 text-emerald-700 font-medium'
          : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-[12px] uppercase tracking-wider px-2.5 h-7 rounded-full border whitespace-nowrap ${
        isActive
          ? 'bg-stone-900 text-white border-stone-900'
          : 'bg-transparent border-stone-300 text-stone-600 hover:bg-white'
      }`}
    >
      {label}
    </button>
  );
}

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 sm:m-5 shadow-xl animate-in slide-in-from-bottom"
      >
        {title && <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-3">{title}</h3>}
        {children}
        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-stone-500 hover:text-stone-900 py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SheetLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block w-full text-left text-base text-stone-800 hover:bg-stone-50 rounded-lg px-3 py-3"
    >
      {children}
    </Link>
  );
}

function SheetButton({
  children,
  onClick,
  isActive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left text-base rounded-lg px-3 py-3 ${
        isActive ? 'bg-stone-900 text-white' : 'text-stone-800 hover:bg-stone-50'
      }`}
    >
      {children}
    </button>
  );
}

function PickButton({ pick, onSet }: { pick: Pick | null; onSet: (p: Pick | null) => void }) {
  const [open, setOpen] = useState(false);

  function quick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pick === 'going') onSet(null);
    else onSet('going');
  }

  function showMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  const display = {
    going: { icon: '\u2605', color: 'text-emerald-600' },
    maybe: { icon: '\u25D0', color: 'text-amber-500' },
    skip: { icon: '\u2715', color: 'text-stone-400' },
    none: { icon: '\u2606', color: 'text-stone-300 hover:text-stone-500' },
  };
  const d = display[pick ?? 'none'];

  return (
    <div className="relative shrink-0">
      <button
        onClick={quick}
        onContextMenu={showMenu}
        aria-label={pick ? `Pick: ${pick}` : 'Mark as going'}
        title={pick ? `Picked ${pick}. Tap to clear, right-click for options.` : 'Tap to mark as going'}
        className={`w-10 h-10 grid place-items-center rounded-full text-2xl leading-none transition ${d.color}`}
      >
        {d.icon}
      </button>
      <button
        onClick={showMenu}
        aria-label="Pick options"
        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 grid place-items-center rounded-full bg-white border border-stone-300 text-[8px] text-stone-500 leading-none"
      >
        \u25be
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} title="Mark as">
          <div className="space-y-1">
            {(['going', 'maybe', 'skip'] as const).map((p) => (
              <SheetButton
                key={p}
                isActive={pick === p}
                onClick={() => {
                  onSet(p);
                  setOpen(false);
                }}
              >
                {p === 'going' && '\u2605 Going'}
                {p === 'maybe' && '\u25D0 Maybe'}
                {p === 'skip' && '\u2715 Skip'}
              </SheetButton>
            ))}
            {pick && (
              <SheetButton
                onClick={() => {
                  onSet(null);
                  setOpen(false);
                }}
              >
                Clear
              </SheetButton>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function EventCard({
  e,
  dayIso,
  pick,
  home,
  onTogglePick,
  onEdit,
  onDelete,
}: {
  e: EventRow;
  dayIso: string;
  pick: Pick | null;
  home: Home | null;
  onTogglePick: (p: Pick | null) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const time = eventTimeLabel(e);
  const multiDay = e.ends_on && e.ends_on !== e.starts_on;
  const map = mapsUrl(e.address);
  const directions = directionsUrl(e.address, { destLat: e.lat, destLng: e.lng });
  const directionsFromHome =
    home && (e.address || (e.lat != null && e.lng != null))
      ? directionsUrl(e.address, {
          destLat: e.lat,
          destLng: e.lng,
          origin:
            home.lat != null && home.lng != null
              ? `${home.lat},${home.lng}`
              : home.address,
        })
      : null;
  const dotColor = phaseColor(e.phase);
  const firstLink = e.links?.[0];
  const mine = isLocal(e);

  const isFaded = pick === 'skip';

  return (
    <li
      className={`group relative rounded-xl py-3 px-3 -mx-3 hover:bg-white/60 transition-colors ${
        isFaded ? 'opacity-40' : ''
      }`}
    >
      <div className="flex gap-3">
        {/* Time column */}
        <div className="shrink-0 w-16 sm:w-20 pt-0.5">
          <div className="text-[12px] font-medium text-stone-900 tabular-nums leading-snug">
            {time}
          </div>
          {multiDay && dayIso === e.starts_on && (
            <div className="text-[9px] uppercase tracking-wider text-stone-400 mt-0.5">
              \u2192 {formatDateShort(e.ends_on!)}
            </div>
          )}
          <div
            className="w-1.5 h-1.5 rounded-full mt-2"
            style={{ background: dotColor }}
            title={e.phase || ''}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-stone-900 leading-snug text-[15px]">
              {mine ? (
                <span>{e.title}</span>
              ) : (
                <Link
                  href={`/event/${e.id}`}
                  className="hover:underline decoration-stone-300 underline-offset-2"
                >
                  {e.title}
                </Link>
              )}
              {mine && (
                <span className="ml-2 inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 align-middle">
                  mine
                </span>
              )}
            </h3>
            <PickButton pick={pick} onSet={onTogglePick} />
          </div>

          {(e.venue || e.address) && (
            <p className="text-[13px] text-stone-600 mt-0.5">
              {e.venue}
              {e.venue && e.address && <span className="text-stone-400"> \u00b7 </span>}
              {map ? (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(ev) => ev.stopPropagation()}
                  className="underline decoration-stone-300 underline-offset-2 hover:decoration-stone-700"
                >
                  {e.address}
                </a>
              ) : (
                e.address
              )}
            </p>
          )}

          {e.notes && (
            <p className="text-[13px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
              {e.notes}
            </p>
          )}

          <div className="flex items-center gap-1 mt-2 text-stone-500 -ml-1">
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                aria-label="Directions"
                title="Directions"
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-stone-200/60 active:bg-stone-200 text-base"
              >
                \u2197
              </a>
            )}
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                downloadIcs(buildIcs([e]), `${slug(e.title) || 'event'}.ics`);
              }}
              aria-label="Add to calendar"
              title="Add to calendar"
              className="w-9 h-9 grid place-items-center rounded-full hover:bg-stone-200/60 active:bg-stone-200 text-base"
            >
              +
            </button>
            {directionsFromHome && (
              <a
                href={directionsFromHome}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                aria-label={`Directions from ${home?.label || 'home'}`}
                title={`Directions from ${home?.label || 'home'}`}
                className="text-[12px] text-stone-500 hover:text-stone-900 px-2 h-9 grid place-items-center rounded-full hover:bg-stone-200/60"
              >
                from ⌂
              </a>
            )}
            {firstLink && (
              <a
                href={firstLink.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                title={`Source: ${firstLink.label}`}
                className="text-[12px] text-stone-500 hover:text-stone-900 px-2 h-9 grid place-items-center rounded-full hover:bg-stone-200/60"
              >
                {firstLink.label}
              </a>
            )}
            {mine ? (
              <span className="ml-auto flex items-center gap-2">
                {onEdit && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEdit();
                    }}
                    className="text-[12px] text-stone-500 hover:text-stone-900 px-2"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDelete();
                    }}
                    className="text-[12px] text-stone-400 hover:text-red-600 px-2"
                  >
                    Delete
                  </button>
                )}
              </span>
            ) : (
              <Link
                href={`/event/${e.id}`}
                className="ml-auto text-[12px] text-stone-400 hover:text-stone-700 px-2"
              >
                More →
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
