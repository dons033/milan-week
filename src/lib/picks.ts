// Picks live only in the user's browser. No account, no server writes.
import type { Pick } from './types';

const KEY = 'milanweek.picks.v1';

type Store = Record<string, Pick>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
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
