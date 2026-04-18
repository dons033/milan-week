'use client';

import dynamic from 'next/dynamic';
import type { EventRow } from '@/lib/types';

const EventsMapInner = dynamic(() => import('./EventsMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-stone-400">
      Loading map…
    </div>
  ),
});

export default function EventsMap({ events }: { events: EventRow[] }) {
  return <EventsMapInner events={events} />;
}
