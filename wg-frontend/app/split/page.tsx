'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import BottomNav from '../components/BottomNav';

export default function SplitPage() {
  const { user, wg, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!wg) router.replace('/wg');
  }, [user, wg, loading, router]);

  if (loading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">💰</div></div>;
  }

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <h1 className="text-2xl font-heading font-bold text-gray-900 mb-6">Ausgaben teilen</h1>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <div className="text-6xl">🚧</div>
          <h2 className="text-lg font-heading font-semibold text-gray-900">Coming Soon</h2>
          <p className="text-sm text-gray-400">
            Hier kannst du bald gemeinsame Ausgaben erfassen und fair aufteilen.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {['Ausgaben erfassen', 'Fair aufteilen', 'Schulden begleichen'].map(f => (
              <span key={f} className="px-3 py-1 bg-accent/5 text-accent text-xs font-medium rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
