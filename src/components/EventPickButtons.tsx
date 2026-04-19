'use client';

import { useEffect, useState } from 'react';
import type { Pick } from '@/lib/types';
import { loadPicks, setPick } from '@/lib/picks';

export default function EventPickButtons({ eventId }: { eventId: string }) {
  const [pick, setLocalPick] = useState<Pick | null>(null);

  useEffect(() => {
    setLocalPick(loadPicks()[eventId] ?? null);
  }, [eventId]);

  function toggle(p: Pick) {
    const next = pick === p ? null : p;
    setPick(eventId, next);
    setLocalPick(next);
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {(['going', 'skip'] as const).map((p) => {
        const active = pick === p;
        const styles: Record<typeof p, string> = {
          going: active
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
          skip: active
            ? 'bg-stone-500 text-white border-stone-500'
            : 'border-stone-300 text-stone-500 hover:bg-stone-100',
        };
        return (
          <button
            key={p}
            onClick={() => toggle(p)}
            className={`text-xs uppercase tracking-wider px-3 py-1 rounded-full border ${styles[p]}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
