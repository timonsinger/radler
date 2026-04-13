'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatPrice } from '@/lib/maps';
import NavBar from '@/components/NavBar';
import LoadingSpinner from '@/components/LoadingSpinner';

interface HistoryRide {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  price: number;
  vehicle_type: string;
  rating?: number;
  driver_name?: string;
  delivery_photo_url?: string;
  pickup_photo_url?: string;
  created_at: string;
  completed_at?: string;
}

function truncate(s: string, len: number) {
  return s.length > len ? s.substring(0, len) + '...' : s;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [rides, setRides] = useState<HistoryRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRide, setSelectedRide] = useState<HistoryRide | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/rides/history?page=${page}&limit=20`)
      .then((data) => {
        if (page === 1) setRides(data.rides);
        else setRides((prev) => [...prev, ...data.rides]);
        setTotalPages(data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center gap-3">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Auftragshistorie</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {rides.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-500">Noch keine abgeschlossenen Aufträge</p>
          </div>
        )}

        {rides.map((ride) => (
          <button
            key={ride.id}
            onClick={() => setSelectedRide(ride)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex gap-3">
              {ride.delivery_photo_url ? (
                <img
                  src={`${apiBase}${ride.delivery_photo_url}`}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : ride.pickup_photo_url ? (
                <img
                  src={`${apiBase}${ride.pickup_photo_url}`}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">{formatDate(ride.created_at)}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    ride.status === 'delivered' ? 'bg-green-100 text-green-700' : ride.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                  }`}>
                    {ride.status === 'delivered' ? 'Zugestellt' : ride.status === 'expired' ? 'Abgelaufen' : 'Storniert'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-sm text-gray-900 truncate">{truncate(ride.pickup_address, 30)}</p>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-sm text-gray-900 truncate">{truncate(ride.dropoff_address, 30)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">{formatPrice(Number(ride.price))}</p>
                  {ride.rating && (
                    <div className="flex">
                      {[1,2,3,4,5].map((s) => (
                        <span key={s} className={`text-sm ${s <= ride.rating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}

        {page < totalPages && (
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="w-full bg-white text-primary font-semibold py-4 rounded-2xl shadow-sm active:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Mehr laden'}
          </button>
        )}

        {loading && page === 1 && (
          <div className="py-8"><LoadingSpinner /></div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedRide(null)} />
          <div className="relative w-full bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pb-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-gray-900">{formatPrice(Number(selectedRide.price))}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedRide.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {selectedRide.status === 'delivered' ? 'Zugestellt' : 'Storniert'}
                </span>
              </div>

              <p className="text-xs text-gray-400">{formatDate(selectedRide.created_at)}</p>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Abholung</p>
                    <p className="text-sm text-gray-900">{selectedRide.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Ziel</p>
                    <p className="text-sm text-gray-900">{selectedRide.dropoff_address}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Distanz</p>
                  <p className="text-sm font-bold">{selectedRide.distance_km ? `${Number(selectedRide.distance_km).toFixed(1)} km` : '–'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Fahrzeug</p>
                  <p className="text-sm font-bold">{selectedRide.vehicle_type === 'bicycle' ? '🚲' : '🚛'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Kurier</p>
                  <p className="text-sm font-bold truncate">{selectedRide.driver_name || '–'}</p>
                </div>
              </div>

              {selectedRide.rating && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400">Bewertung:</p>
                  <div className="flex">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} className={`text-lg ${s <= selectedRide.rating! ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRide.pickup_photo_url && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Abhol-Foto</p>
                  <img src={`${apiBase}${selectedRide.pickup_photo_url}`} alt="Abholung" className="w-full rounded-2xl object-cover max-h-48" />
                </div>
              )}

              {selectedRide.delivery_photo_url && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Ablieferungs-Foto</p>
                  <img src={`${apiBase}${selectedRide.delivery_photo_url}`} alt="Ablieferung" className="w-full rounded-2xl object-cover max-h-48" />
                </div>
              )}

              <button
                onClick={() => setSelectedRide(null)}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl active:bg-gray-200"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}
