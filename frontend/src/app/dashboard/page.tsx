'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, logout } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import NavBar from '@/components/NavBar';
import RideCard from '@/components/RideCard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  created_at: string;
  vehicle_type: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <img src="/radler_logo.svg" alt="Radler" className="h-8 w-auto mb-1" />
            <p className="text-gray-500 text-sm">Hallo, {user.name.split(' ')[0]}! 👋</p>
          </div>
          <button
            onClick={logout}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Service Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/book">
            <div className="bg-primary rounded-3xl p-5 shadow-md shadow-primary/30 active:bg-primary-dark transition-colors">
              <div className="text-3xl mb-3">🚲</div>
              <h3 className="text-primary-fg font-bold text-base">Kurier buchen</h3>
              <p className="text-primary-fg/70 text-xs mt-0.5">Jetzt verfügbar</p>
            </div>
          </Link>

          <div className="bg-gray-200 rounded-3xl p-5 relative overflow-hidden opacity-60">
            <div className="text-3xl mb-3">🛺</div>
            <h3 className="text-gray-600 font-bold text-base">Rikscha</h3>
            <p className="text-gray-500 text-xs mt-0.5">Personentransport</p>
            <span className="absolute top-3 right-3 bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full font-medium">
              Bald
            </span>
          </div>
        </div>

        {/* Buchungen */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Meine Buchungen</h2>
          {loading ? (
            <div className="py-8"><LoadingSpinner /></div>
          ) : rides.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-gray-500 text-sm">Noch keine Buchungen</p>
              <Link href="/book">
                <span className="inline-block mt-3 text-primary font-semibold text-sm">Ersten Kurier buchen →</span>
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
