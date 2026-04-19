'use client';

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { EventRow, Pick } from '@/lib/types';
import { formatDayHeading, eventTimeLabel, directionsUrl, formatDateShort, expandEventDays } from '@/lib/format';
import { loadPicks } from '@/lib/picks';
import { loadPrefs, type Home } from '@/lib/prefs';
import { loadLocalEvents } from '@/lib/localEvents';
import 'leaflet/dist/leaflet.css';

// Milan city centre (Duomo), used as the default map center.
const MILAN_CENTRE: [number, number] = [45.4642, 9.1900];

const eventIcon = L.divIcon({
  html: `<div style="background:#1c1917;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,0.25);border:2px solid #fff;">\u25CF</div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const confirmedIcon = L.divIcon({
  html: `<div style="background:#047857;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,0.25);border:2px solid #fff;">\u2713</div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const goingIcon = L.divIcon({
  html: `<div style="background:#059669;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:2px solid #fff;">\u2605</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const meIcon = L.divIcon({
  html: `<div style="background:#2563eb;width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 6px rgba(37,99,235,0.25),0 1px 4px rgba(0,0,0,0.3);border:2px solid #fff;"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const homeIcon = L.divIcon({
  html: `<div style="background:#0f172a;color:#fff;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:2px solid #fff;">\u2302</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function iconFor(e: EventRow, pick: Pick | null) {
  if (pick === 'going') return goingIcon;
  const isConfirmed = (e.status || '').toUpperCase().includes('CONFIRMED');
  return isConfirmed ? confirmedIcon : eventIcon;
}

function LocateControl({ onLocated }: { onLocated: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function handleClick() {
    if (!('geolocation' in navigator)) {
      setErr('Geolocation not supported');
      return;
    }
    setLoading(true);
    setErr('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onLocated(latitude, longitude);
        map.flyTo([latitude, longitude], 15, { duration: 0.8 });
        setLoading(false);
      },
      (e) => {
        setErr(e.code === 1 ? 'Permission denied' : 'Could not locate');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
      <div className="leaflet-control" style={{ pointerEvents: 'auto', margin: '10px' }}>
        <button
          onClick={handleClick}
          disabled={loading}
          className="bg-white border border-stone-300 rounded shadow px-3 py-1.5 text-xs font-medium hover:bg-stone-50 disabled:opacity-50"
          title="Show my location"
        >
          {loading ? 'Locating\u2026' : '\u25CE Locate me'}
        </button>
        {err && (
          <div className="mt-1 bg-red-50 border border-red-200 text-red-700 rounded text-[11px] px-2 py-1">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}

function EventPopup({ e }: { e: EventRow }) {
  const dir = directionsUrl(e.address, { destLat: e.lat, destLng: e.lng });
  return (
    <div style={{ minWidth: 200 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.title}</div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
        {formatDayHeading(e.starts_on)} &middot; {eventTimeLabel(e)}
      </div>
      {e.venue && <div style={{ fontSize: 12 }}>{e.venue}</div>}
      {e.address && <div style={{ fontSize: 12, color: '#888' }}>{e.address}</div>}
      {e.phase && (
        <div style={{ marginTop: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>
          {e.phase}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
        {dir && (
          <a href={dir} target="_blank" rel="noopener noreferrer" style={{ color: '#1c1917', textDecoration: 'underline' }}>
            Directions
          </a>
        )}
        {e.links?.slice(0, 3).map((link, i) => (
          <a
            key={`${link.url}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: i === 0 ? '#1c1917' : '#6b7280', textDecoration: i === 0 ? 'underline' : 'none' }}
          >
            {link.label}
            {i === 0 ? ' \u2192' : ''}
          </a>
        ))}
      </div>
    </div>
  );
}

function ClusteredMarkers({ events, picks }: { events: EventRow[]; picks: Record<string, Pick> }) {
  const map = useMap();

  useEffect(() => {
    const cluster = (L as unknown as { markerClusterGroup: (opts?: object) => L.LayerGroup }).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
    });

    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const pick = picks[e.id] || null;
      const marker = L.marker([e.lat, e.lng], { icon: iconFor(e, pick) });
      marker.bindPopup(() => {
        const div = document.createElement('div');
        const root = createRoot(div);
        root.render(<EventPopup e={e} />);
        return div;
      });
      (cluster as unknown as { addLayer: (l: L.Layer) => void }).addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [events, picks, map]);

  return null;
}

function dayInRange(day: string, e: EventRow) {
  return expandEventDays(e.starts_on, e.ends_on).includes(day);
}

export default function EventsMapInner({ events }: { events: EventRow[] }) {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [goingOnly, setGoingOnly] = useState(false);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [localEvents, setLocalEvents] = useState<EventRow[]>([]);
  const [home, setHome] = useState<Home | null>(null);

  useEffect(() => {
    setPicks(loadPicks());
    setLocalEvents(loadLocalEvents());
    setHome(loadPrefs().home);
  }, []);

  const allEvents = useMemo(() => [...events, ...localEvents], [events, localEvents]);

  const days = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) {
      for (const d of expandEventDays(e.starts_on, e.ends_on)) set.add(d);
    }
    return Array.from(set).sort();
  }, [allEvents]);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (goingOnly && picks[e.id] !== 'going') return false;
      if (activeDay && !dayInRange(activeDay, e)) return false;
      return true;
    });
  }, [allEvents, activeDay, goingOnly, picks]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MILAN_CENTRE}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocateControl onLocated={(lat, lng) => setMe({ lat, lng })} />
        {home && home.lat != null && home.lng != null && (
          <Marker position={[home.lat, home.lng]} icon={homeIcon}>
            <Popup>
              <strong>{home.label}</strong>
              <br />
              {home.address}
            </Popup>
          </Marker>
        )}
        {me && (
          <Marker position={[me.lat, me.lng]} icon={meIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        <ClusteredMarkers events={filtered} picks={picks} />
      </MapContainer>

      <div className="absolute top-2 left-2 z-[500] flex flex-wrap gap-1 max-w-[calc(100%-1rem)] pointer-events-auto">
        <button
          onClick={() => setActiveDay(null)}
          className={`text-[11px] px-2.5 py-1 rounded-full border shadow-sm ${
            activeDay === null
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
          }`}
        >
          All
        </button>
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDay(d === activeDay ? null : d)}
            className={`text-[11px] px-2.5 py-1 rounded-full border shadow-sm ${
              activeDay === d
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {formatDateShort(d)}
          </button>
        ))}
        <button
          onClick={() => setGoingOnly((v) => !v)}
          className={`text-[11px] px-2.5 py-1 rounded-full border shadow-sm ${
            goingOnly
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
          }`}
          title="Show only events you marked going"
        >
          {goingOnly ? '\u2605 going' : 'going only'}
        </button>
        <span className="text-[11px] px-2 py-1 rounded-full bg-stone-50/80 border border-stone-200 text-stone-500">
          {filtered.filter((e) => e.lat != null).length}
        </span>
      </div>
    </div>
  );
}
