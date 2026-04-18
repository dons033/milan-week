import type { MetadataRoute } from 'next';

const HOST = 'https://milan-week.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${HOST}/sitemap.xml`,
  };
}
