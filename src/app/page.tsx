import { supabase } from '@/lib/supabase';
import type { EventRow } from '@/lib/types';
import Planner from '@/components/Planner';

export const dynamic = 'force-dynamic';

async function fetchEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_on', { ascending: true });
  if (error) {
    console.error('Supabase fetch failed:', error.message);
    return [];
  }
  return (data || []) as EventRow[];
}

export default async function Home() {
  const events = await fetchEvents();
  return <Planner initialEvents={events} />;
}
