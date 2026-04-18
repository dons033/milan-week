import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

// Public canonical host. Update if the custom domain changes.
const HOST = 'https://milan-week.vercel.app';

export const revalidate = 3600; // refresh once an hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await supabase.from('events').select('id, updated_at').order('starts_on');
  const events = data || [];

  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${HOST}/`,       lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
    { url: `${HOST}/map`,    lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${HOST}/about`,  lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
  const eventRoutes: MetadataRoute.Sitemap = events.map((e) => ({
    url: `${HOST}/event/${e.id}`,
    lastModified: e.updated_at ? new Date(e.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...eventRoutes];
}
