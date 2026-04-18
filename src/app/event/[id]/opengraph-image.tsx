import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import type { EventRow } from '@/lib/types';
import { formatDayHeading, eventTimeLabel } from '@/lib/format';

export const runtime = 'edge';
export const alt = 'Milan Week event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function fetchEvent(id: string): Promise<EventRow | null> {
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  return (data as EventRow) || null;
}

export default async function OG({ params }: { params: { id: string } }) {
  const e = await fetchEvent(params.id);

  // Colours from the handrail favicon
  const BROWN_BG = '#b17c5a';
  const BROWN_DARK = '#6b3e28';
  const CREAM = '#f7ede3';
  const RED = '#c4342c';

  const title = e?.title || 'Milan Week';
  const day = e ? formatDayHeading(e.starts_on) : '';
  const time = e ? eventTimeLabel(e) : '';
  const venue = e?.venue || e?.address || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BROWN_BG,
          display: 'flex',
          flexDirection: 'column',
          padding: 72,
          fontFamily: 'sans-serif',
          color: BROWN_DARK,
          position: 'relative',
        }}
      >
        {/* wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 600, letterSpacing: '0.02em', color: BROWN_DARK }}>
          <div style={{ width: 18, height: 28, background: RED, borderRadius: 2 }} />
          MILAN WEEK
        </div>

        {/* title block */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          <div
            style={{
              fontSize: title.length > 70 ? 56 : title.length > 40 ? 72 : 88,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: CREAM,
              maxWidth: 1050,
              display: 'flex',
            }}
          >
            {title}
          </div>
          {e && (
            <div style={{ fontSize: 30, color: BROWN_DARK, display: 'flex', gap: 18, alignItems: 'center', opacity: 0.9 }}>
              <span>{day}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{time}</span>
            </div>
          )}
          {venue && (
            <div style={{ fontSize: 26, color: BROWN_DARK, opacity: 0.8, display: 'flex' }}>
              {venue}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
