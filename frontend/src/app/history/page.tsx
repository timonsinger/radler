'use client';

import { useEffect, useState, useCallback } from 'react';
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
  driver_id?: string;
  driver_name?: string;
  driver_profile_image_url?: string;
  delivery_photo_url?: string;
  pickup_photo_url?: string;
  description?: string;
  service_type?: string;
  created_at: string;
  completed_at?: string;
}

interface DriverProfile {
  id: string;
  name: string;
  profile_image_url?: string;
  member_since: string;
  vehicle_type?: string;
  rating?: number;
  description?: string;
  availability?: string;
  completed_rides?: number;
}

interface Review {
  rating: number;
  comment?: string;
  date: string;
  customer_name: string;
}

function truncate(s: string, len: number) {
  return s.length > len ? s.substring(0, len) + '...' : s;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatMemberSince(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export default function HistoryPage() {
  const router = useRouter();
  const [rides, setRides] = useState<HistoryRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRide, setSelectedRide] = useState<HistoryRide | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [driverReviews, setDriverReviews] = useState<Review[]>([]);
  const [driverReviewCount, setDriverReviewCount] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

  const loadReviews = useCallback((driverId: string, pg: number) => {
    setReviewsLoading(true);
    apiFetch(`/api/drivers/${driverId}/reviews?page=${pg}&limit=10`)
      .then((data) => {
        if (pg === 1) setDriverReviews(data.reviews || []);
        else setDriverReviews((prev) => [...prev, ...(data.reviews || [])]);
        setReviewsTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, []);

  const openDriverProfile = useCallback((driverId: string) => {
    setDriverProfile(null);
    setDriverReviews([]);
    setReviewsPage(1);
    setDriverReviewCount(0);
    setShowDriverModal(true);

    apiFetch(`/api/auth/profile/${driverId}`)
      .then((data) => {
        if (data.profile) setDriverProfile(data.profile);
      })
      .catch(() => {});
    apiFetch(`/api/drivers/${driverId}/reviews?limit=1`)
      .then((data) => {
        setDriverReviewCount(data.total_reviews || 0);
      })
      .catch(() => {});
    loadReviews(driverId, 1);
  }, [loadReviews]);

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
        <h1 className="font-heading text-lg font-bold text-radler-ink-800">Auftragshistorie</h1>
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
        <div className="fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedRide(null)} />
          <div className="relative w-full bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-gray-900">{formatPrice(Number(selectedRide.price))}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedRide.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {selectedRide.status === 'delivered' ? 'Zugestellt' : 'Storniert'}
                </span>
              </div>

              <p className="text-xs text-gray-400">{formatDate(selectedRide.created_at)}</p>

              {/* Kurier-Profil klickbar */}
              {selectedRide.driver_id && selectedRide.driver_name && (
                <button
                  onClick={() => openDriverProfile(selectedRide.driver_id!)}
                  className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-3 active:bg-gray-100 transition-colors"
                >
                  {selectedRide.driver_profile_image_url ? (
                    <img
                      src={`${apiBase}${selectedRide.driver_profile_image_url}`}
                      alt={selectedRide.driver_name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{selectedRide.driver_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-gray-900">{selectedRide.driver_name}</p>
                    <p className="text-xs text-gray-400">Kurier · Profil ansehen</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

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

              {selectedRide.description && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0">💬</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">Auftragsbeschreibung:</p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedRide.description}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Distanz</p>
                  <p className="text-sm font-bold">{selectedRide.distance_km ? `${Number(selectedRide.distance_km).toFixed(1)} km` : '–'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400">Fahrzeug</p>
                  <p className="text-sm font-bold">
                    {selectedRide.vehicle_type === 'bicycle' ? '🚲 Fahrrad' : selectedRide.vehicle_type === 'cargo_bike' ? '🚛 Lastenrad' : selectedRide.vehicle_type === 'rikscha' ? '🛺 Rikscha' : selectedRide.vehicle_type === 'rikscha_xl' ? '🛺 Rikscha XL' : selectedRide.vehicle_type === 'tandem' ? '🚲 Tandem' : selectedRide.vehicle_type}
                  </p>
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
            </div>
            <div className="px-5 pt-2 pb-8 flex-shrink-0 bg-white">
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

      {/* Fahrer-Profil Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 z-[70] flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDriverModal(false)} />
          <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowDriverModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center z-10"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pb-8 space-y-5 overflow-y-auto flex-1 min-h-0">
              {!driverProfile ? (
                <div className="py-8"><LoadingSpinner /></div>
              ) : (
                <>
                  {/* Avatar + Name */}
                  <div className="flex flex-col items-center text-center pt-2">
                    {driverProfile.profile_image_url ? (
                      <img
                        src={`${apiBase}${driverProfile.profile_image_url}`}
                        alt={driverProfile.name}
                        className="w-20 h-20 rounded-full object-cover mb-3"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-3">
                        <span className="text-white text-3xl font-bold">{driverProfile.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-gray-900">{driverProfile.name}</h2>
                    <p className="text-xs text-gray-400 mt-1">Dabei seit {formatMemberSince(driverProfile.member_since)}</p>

                    {driverProfile.rating && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex">
                          {[1,2,3,4,5].map((s) => (
                            <span key={s} className={`text-lg ${s <= Math.round(Number(driverProfile.rating)) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                          ))}
                        </div>
                        <span className="text-sm font-bold text-gray-700">{Number(driverProfile.rating).toFixed(1)}</span>
                        {driverReviewCount > 0 && (
                          <span className="text-xs text-gray-400">({driverReviewCount} Bewertungen)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">Fahrzeug</p>
                      <p className="text-sm font-bold mt-0.5">{driverProfile.vehicle_type === 'bicycle' ? '🚲 Fahrrad' : '🚛 Lastenrad'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">Fahrten</p>
                      <p className="text-sm font-bold mt-0.5">{driverProfile.completed_rides ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400">Bewertung</p>
                      <p className="text-sm font-bold mt-0.5">{driverProfile.rating ? Number(driverProfile.rating).toFixed(1) : '–'}</p>
                    </div>
                  </div>

                  {/* Beschreibung */}
                  {driverProfile.description && (
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Über mich</p>
                      <p className="text-sm text-gray-700">{driverProfile.description}</p>
                    </div>
                  )}

                  {/* Verfügbarkeit */}
                  {driverProfile.availability && (
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Verfügbarkeit</p>
                      <p className="text-sm text-gray-700">{driverProfile.availability}</p>
                    </div>
                  )}

                  {/* Bewertungen */}
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase mb-3">Bewertungen</p>
                    {driverReviews.length === 0 && !reviewsLoading && (
                      <p className="text-sm text-gray-400 text-center py-4">Noch keine Bewertungen</p>
                    )}
                    <div className="space-y-3">
                      {driverReviews.map((review, i) => (
                        <div key={i} className="bg-gray-50 rounded-2xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {[1,2,3,4,5].map((s) => (
                                  <span key={s} className={`text-sm ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-gray-600">{review.customer_name}</span>
                            </div>
                            {review.date && (
                              <span className="text-xs text-gray-300">{formatDate(review.date)}</span>
                            )}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {reviewsPage < reviewsTotalPages && selectedRide?.driver_id && (
                      <button
                        onClick={() => {
                          const next = reviewsPage + 1;
                          setReviewsPage(next);
                          loadReviews(selectedRide.driver_id!, next);
                        }}
                        disabled={reviewsLoading}
                        className="w-full text-primary font-semibold text-sm py-3 mt-3 active:text-primary/70 disabled:opacity-50"
                      >
                        {reviewsLoading ? 'Laden...' : 'Mehr Bewertungen laden'}
                      </button>
                    )}
                    {reviewsLoading && driverReviews.length === 0 && (
                      <div className="py-4"><LoadingSpinner /></div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}
