'use client';

import type { EventRow } from '@/lib/types';
import { buildIcs, downloadIcs, slug } from '@/lib/ics';

export default function EventIcsButton({ event }: { event: EventRow }) {
  return (
    <button
      onClick={() => downloadIcs(buildIcs([event]), `${slug(event.title) || 'event'}.ics`)}
      className="border border-stone-300 text-stone-800 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-white"
      title="Download an .ics file you can import into Apple or Google Calendar"
    >
      + Add to calendar
    </button>
  );
}
