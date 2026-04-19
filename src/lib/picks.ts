// Picks live only in the user's browser. No account, no server writes.
import type { Pick } from './types';

const KEY = 'milanweek.picks.v1';

type Store = Record<string, Pick>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>;
    // Migrate: 'maybe' was retired — drop any residual values so the type stays honest.
    const out: Store = {};
    for (const [id, v] of Object.entries(raw)) {
      if (v === 'going' || v === 'skip') out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function loadPicks(): Store {
  return read();
}

export function setPick(id: string, next: Pick | null) {
  const store = read();
  if (next === null) {
    delete store[id];
  } else {
    store[id] = next;
  }
  write(store);
}

export function clearPicks() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
