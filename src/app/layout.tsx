import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Milan Week',
  description: 'A public planner for Milan Design Week 2026',
  applicationName: 'Milan Week',
  appleWebApp: {
    capable: true,
    title: 'Milan Week',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#6b3e28',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
