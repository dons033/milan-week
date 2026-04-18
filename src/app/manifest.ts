import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Milan Week',
    short_name: 'Milan Week',
    description: 'A public planner for Milan Design Week 2026',
    start_url: '/',
    display: 'standalone',
    background_color: '#b17c5a',
    theme_color: '#6b3e28',
    orientation: 'portrait',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
