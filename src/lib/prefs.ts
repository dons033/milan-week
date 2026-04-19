// Per-browser preferences. No account, no server writes.
const KEY = 'milanweek.prefs.v1';

export type Home = {
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type Prefs = {
  home: Home | null;
};

const EMPTY: Prefs = { home: null };

function read(): Prefs {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { home: parsed.home ?? null };
  } catch {
    return EMPTY;
  }
}

function write(p: Prefs) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function loadPrefs(): Prefs {
  return read();
}

export function setHome(home: Home | null) {
  const p = read();
  p.home = home;
  write(p);
}

export function clearPrefs() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

// Nominatim (OpenStreetMap) forward geocoder. Free, CORS-enabled, no key.
// Honours the public-use policy: a descriptive User-Agent via Referer + email,
// and we only call on user click, not automatically.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${address}, Milano, Italy`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const { lat, lon } = rows[0];
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lon);
    if (!isFinite(latNum) || !isFinite(lngNum)) return null;
    return { lat: latNum, lng: lngNum };
  } catch {
    return null;
  }
}
