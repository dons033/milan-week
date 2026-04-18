-- Milan Week schema. Read-only for the public; seed scripts use the
-- service-role key to bypass RLS when writing.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date,
  starts_time text,
  ends_time text,
  title text not null,
  host text,
  venue text,
  address text,
  phase text,
  notes text,
  rsvp text,
  source text,
  source_url text,
  status text,
  lat double precision,
  lng double precision,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists events_starts_on_idx on events(starts_on);
create index if not exists events_latlng_idx on events(lat, lng) where lat is not null;

alter table events enable row level security;
drop policy if exists "public read" on events;
drop policy if exists "public write" on events;
create policy "public read" on events for select using (true);
