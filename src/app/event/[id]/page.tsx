import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { EventRow } from '@/lib/types';
import {
  eventTimeLabel,
  formatDayHeading,
  formatDateShort,
  mapsUrl,
  directionsUrl,
  shortSource,
} from '@/lib/format';
import EventPickButtons from '@/components/EventPickButtons';
import EventIcsButton from '@/components/EventIcsButton';

export const dynamic = 'force-dynamic';

async function fetchEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as EventRow;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await fetchEvent(id);
  if (!e) return { title: 'Event · Milan Week' };
  const locationBits = [e.venue, e.address].filter(Boolean).join(' · ');
  const descBits = [formatDayHeading(e.starts_on), eventTimeLabel(e), locationBits].filter(Boolean).join(' · ');
  return {
    title: `${e.title} · Milan Week`,
    description: e.notes || descBits,
    openGraph: {
      title: e.title,
      description: descBits + (e.notes ? ` — ${e.notes}` : ''),
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: e.title,
      description: descBits,
    },
  };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await fetchEvent(id);
  if (!e) notFound();

  const time = eventTimeLabel(e);
  const multiDay = e.ends_on && e.ends_on !== e.starts_on;
  const map = mapsUrl(e.address);
  const directions = directionsUrl(e.address, { destLat: e.lat, destLng: e.lng });
  const isConfirmed = (e.status || '').toUpperCase().includes('CONFIRMED');
  const sourceLabel = shortSource(e.source);

  // schema.org Event JSON-LD for SEO / rich results
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.starts_on,
    endDate: e.ends_on || e.starts_on,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };
  if (e.notes) jsonLd.description = e.notes;
  if (e.host) jsonLd.organizer = { '@type': 'Organization', name: e.host };
  const placeName = e.venue || e.address || 'Milano';
  const place: Record<string, unknown> = {
    '@type': 'Place',
    name: placeName,
    address: e.address
      ? { '@type': 'PostalAddress', streetAddress: e.address, addressLocality: 'Milano', addressCountry: 'IT' }
      : { '@type': 'PostalAddress', addressLocality: 'Milano', addressCountry: 'IT' },
  };
  if (e.lat != null && e.lng != null) {
    place.geo = { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng };
  }
  jsonLd.location = place;
  if (e.links?.[0]?.url) jsonLd.url = e.links[0].url;

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/" className="inline-block text-sm text-stone-500 hover:text-stone-900 mb-8">
        ← All events
      </Link>

      <article>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          {isConfirmed && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Confirmed
            </span>
          )}
          {e.phase && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {e.phase}
            </span>
          )}
          {sourceLabel && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              {sourceLabel}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 leading-tight mb-4">{e.title}</h1>

        <div className="text-sm text-stone-600 mb-6 space-y-1">
          <div>
            <span className="font-medium">{formatDayHeading(e.starts_on)}</span>
            {multiDay && <span className="text-stone-400"> → {formatDateShort(e.ends_on!)}</span>}
            <span className="text-stone-400"> · </span>
            <span>{time}</span>
          </div>
          {e.host && <div className="text-stone-500">{e.host}</div>}
        </div>

        {(e.venue || e.address) && (
          <div className="mb-6 text-sm">
            {e.venue && <div className="text-stone-700">{e.venue}</div>}
            {e.address &&
              (map ? (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-600 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-700"
                >
                  {e.address}
                </a>
              ) : (
                <div className="text-stone-600">{e.address}</div>
              ))}
          </div>
        )}

        {e.notes && <p className="text-stone-700 leading-relaxed mb-6">{e.notes}</p>}

        {e.rsvp && (
          <p className="text-sm text-stone-600 italic bg-stone-100 border-l-2 border-stone-300 px-3 py-2 mb-6">
            ⚑ {e.rsvp}
          </p>
        )}

        <div className="border-t border-stone-200 pt-5 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Your pick</div>
            <EventPickButtons eventId={e.id} />
          </div>
          <EventIcsButton event={e} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm items-center">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-800 underline decoration-stone-400 underline-offset-2 hover:decoration-stone-800"
            >
              Directions →
            </a>
          )}
          {e.links?.slice(0, 3).map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                i === 0
                  ? 'border border-stone-300 text-stone-800 hover:bg-white rounded-full px-3 py-1 text-sm'
                  : 'text-stone-500 hover:text-stone-900'
              }
            >
              {link.label}
              {i === 0 ? ' →' : ''}
            </a>
          ))}
        </div>
      </article>
    </main>
  );
}
