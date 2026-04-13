'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface Stats {
  completed_rides: number;
  earnings_today: number;
  average_rating: number | null;
}

export default function StatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch('/api/drivers/stats')
      .then((data) => setStats(data.stats))
      .catch(console.error);
  }, []);

  const items = [
    {
      label: 'Fahrten heute',
      value: stats?.completed_rides ?? '–',
      icon: '🚲',
    },
    {
      label: 'Verdienst',
      value: stats ? `${stats.earnings_today.toFixed(2).replace('.', ',')} €` : '–',
      icon: '💶',
    },
    {
      label: 'Bewertung',
      value: stats?.average_rating ? `${Number(stats.average_rating).toFixed(1)} ★` : '–',
      icon: '⭐',
    },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Heute</p>
      </div>
      <Link href="/history" className="grid grid-cols-3 divide-x divide-gray-100 active:bg-gray-50 transition-colors">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center py-4 px-2">
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="font-bold text-gray-900 text-base">{item.value}</span>
            <span className="text-xs text-gray-400 text-center mt-0.5">{item.label}</span>
          </div>
        ))}
      </Link>
    </div>
  );
}
