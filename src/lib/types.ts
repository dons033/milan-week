export type Pick = 'going' | 'maybe' | 'skip';

export type EventRow = {
  id: string;
  starts_on: string;
  ends_on: string | null;
  starts_time: string | null;
  ends_time: string | null;
  title: string;
  host: string | null;
  venue: string | null;
  address: string | null;
  phase: string | null;
  notes: string | null;
  rsvp: string | null;
  source: string | null;
  source_url: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
