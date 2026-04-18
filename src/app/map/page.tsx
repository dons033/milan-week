import { supabase } from '@/lib/supabase';
import type { EventRow } from '@/lib/types';
import EventsMap from '@/components/EventsMap';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('starts_on', { ascending: true });
  if (error) {
    console.error('Map fetch failed:', error.message);
    return [];
  }
  return (data || []) as EventRow[];
}

export default async function MapPage() {
  const events = await fetchEvents();
  return (
    <main className="h-screen flex flex-col">
      <header className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-stone-50 z-[1000]">
        <div className="flex items-baseline gap-4">
          <Link href="/" className="text-xl font-semibold tracking-tight hover:text-stone-600">
            Milan Week
          </Link>
          <span className="text-sm text-stone-500">{events.length} mapped events</span>
        </div>
        <Link href="/" className="text-sm text-stone-600 hover:text-stone-900 underline underline-offset-4">
          ← List
        </Link>
      </header>
      <div className="flex-1 min-h-0 relative">
        <EventsMap events={events} />
      </div>
    </main>
  );
}
