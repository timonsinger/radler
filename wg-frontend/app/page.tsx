'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './lib/auth';

export default function Home() {
  const { user, wg, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
    } else if (!wg) {
      router.replace('/wg');
    } else {
      router.replace('/dashboard');
    }
  }, [user, wg, loading, router]);

  // Service Worker registrieren
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-6xl animate-pulse">🧹</div>
    </div>
  );
}
