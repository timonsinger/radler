'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, logout } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import NavBar from '@/components/NavBar';
import RideCard from '@/components/RideCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  created_at: string;
  vehicle_type: string;
  scheduled_at?: string;
  is_scheduled?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  useInactivityLogout();

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }
    setUser(stored);
    apiFetch('/api/rides')
      .then((data) => setRides(data.rides?.slice(0, 10) || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between">
          <div>
            {/* RADLER Logo-Badge */}
            <span className="inline-block bg-radler-ink-800 text-white font-heading font-bold text-sm tracking-[1.5px] px-3.5 py-1.5 rounded-[10px] mb-2">
              RADLER
            </span>
            <p className="font-heading font-medium text-base text-radler-ink-800">
              Hallo, {user.name.split(' ')[0]}! 👋
            </p>
          </div>
          <button
            onClick={logout}
            className="w-10 h-10 bg-radler-ink-100 rounded-full flex items-center justify-center active:bg-radler-ink-200 transition-colors"
            style={{ transitionDuration: 'var(--duration-fast)' }}
          >
            <svg className="w-5 h-5 text-radler-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Service Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* 4a: Kurier-Card */}
          <Link href="/book">
            <div
              className="relative overflow-hidden rounded-[16px] p-[24px_20px] min-h-[120px] active:opacity-90 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #43A047 0%, #2E7D32 50%, #1B5E20 100%)',
                transitionDuration: 'var(--duration-fast)',
              }}
            >
              {/* Dekorative Kreise */}
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

              <div className="relative z-10">
                <div className="text-3xl mb-3">🚲</div>
                <h3 className="font-heading font-semibold text-base text-white">Kurier buchen</h3>
                <p className="font-body text-xs text-white/75 mt-0.5">Jetzt verfügbar</p>
              </div>
            </div>
          </Link>

          {/* 4b: Rikscha-Card */}
          <div
            className="relative overflow-hidden rounded-[16px] p-[24px_20px] min-h-[120px] opacity-60"
            style={{
              background: '#FFFDF5',
              border: '1px solid #FAEFD4',
            }}
          >
            <div className="text-3xl mb-3">🛺</div>
            <h3 className="font-heading font-semibold text-base text-radler-ink-600">Rikscha</h3>
            <p className="font-body text-xs text-radler-ink-400 mt-0.5">Personentransport</p>
            <span
              className="absolute top-3 right-3 font-body font-semibold"
              style={{
                background: '#FFF0EC',
                color: '#C44525',
                fontSize: '11px',
                borderRadius: '20px',
                padding: '3px 10px',
              }}
            >
              Bald
            </span>
          </div>
        </div>

        {/* Buchungen */}
        <div>
          <h2 className="font-heading text-lg font-bold text-radler-ink-800 mb-3">Meine Buchungen</h2>
          {loading ? (
            <div className="py-8"><LoadingSpinner /></div>
          ) : rides.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-[16px]" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="text-4xl mb-3">📦</div>
              <p className="font-body text-sm text-radler-ink-400">Noch keine Buchungen</p>
              <Link href="/book">
                <span className="inline-block mt-3 text-radler-green-500 font-body font-semibold text-sm">Ersten Kurier buchen →</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {rides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}
        </div>
      </div>

      <NavBar />
    </div>
  );
}
