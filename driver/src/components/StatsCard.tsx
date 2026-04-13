'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Stats {
  completed_rides: number;
  earnings_today: number;
  average_rating: number | null;
  total_reviews: number;
}

export default function StatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch('/api/drivers/stats')
      .then((data) => setStats(data.stats))
      .catch(console.error);
  }, []);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Heute</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <Link href="/history" className="flex flex-col items-center py-4 px-2 active:bg-gray-50 transition-colors">
          <span className="text-xl mb-1">🚲</span>
          <span className="font-bold text-gray-900 text-base">{stats?.completed_rides ?? '–'}</span>
          <span className="text-xs text-gray-400 text-center mt-0.5">Fahrten heute</span>
        </Link>
        <Link href="/history" className="flex flex-col items-center py-4 px-2 active:bg-gray-50 transition-colors">
          <span className="text-xl mb-1">💶</span>
          <span className="font-bold text-gray-900 text-base">
            {stats ? `${stats.earnings_today.toFixed(2).replace('.', ',')} €` : '–'}
          </span>
          <span className="text-xs text-gray-400 text-center mt-0.5">Verdienst</span>
        </Link>
        <Link href="/reviews" className="flex flex-col items-center py-4 px-2 active:bg-gray-50 transition-colors">
          <span className="text-xl mb-1">⭐</span>
          <span className="font-bold text-gray-900 text-base">
            {stats?.average_rating ? `${Number(stats.average_rating).toFixed(1)} ★` : '–'}
          </span>
          <span className="text-xs text-gray-400 text-center mt-0.5">
            {stats?.total_reviews ? `${stats.total_reviews} Bewertungen` : 'Bewertung'}
          </span>
        </Link>
      </div>
    </div>
  );
}
