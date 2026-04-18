'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegister() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('SW registration failed', err));
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] bg-amber-100 text-amber-900 border border-amber-300 text-xs px-3 py-1.5 rounded-full shadow">
      Offline — showing cached events
    </div>
  );
}
