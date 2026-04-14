'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { getStatusLabel } from '@/lib/maps';
import Map from '@/components/Map';
import StatusBar from '@/components/StatusBar';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  price: number;
  vehicle_type: string;
  driver_id?: string;
  driver_name?: string;
  customer_name?: string;
  delivery_photo_url?: string;
  pickup_photo_url?: string;
  pickup_method?: string;
  pickup_code?: string;
  pickup_code_confirmed?: boolean;
  delivery_method?: string;
  delivery_code?: string;
  delivery_code_confirmed?: boolean;
  rating?: number;
  rating_comment?: string;
  scheduled_at?: string;
  is_scheduled?: boolean;
  service_type?: string;
  passenger_count?: number;
  tour_duration_hours?: number;
}

interface LocationPing {
  lat: number;
  lng: number;
  timestamp: number;
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

const MAX_PINGS = 10;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatMemberSince(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationPings, setLocationPings] = useState<LocationPing[]>([]);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);
  const [secondsSinceLastPing, setSecondsSinceLastPing] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rating state
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [existingRating, setExistingRating] = useState<{ rating: number; comment?: string } | null>(null);

  // Countdown for scheduled rides
  const [countdown, setCountdown] = useState('');

  // Driver profile state
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [driverReviewCount, setDriverReviewCount] = useState(0);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverReviews, setDriverReviews] = useState<Review[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Ride laden
  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/rides/${id}`)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRide(data.ride);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Countdown für geplante Lieferungen
  useEffect(() => {
    if (!ride?.is_scheduled || !ride?.scheduled_at || ride.status !== 'scheduled') return;
    const timer = setInterval(() => {
      const now = Date.now();
      const target = new Date(ride.scheduled_at!).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown('Wird aktiviert...');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) {
        setCountdown(`${days}T ${hours}h ${mins}min`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${mins}min ${secs}s`);
      } else {
        setCountdown(`${mins}min ${secs}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [ride?.is_scheduled, ride?.scheduled_at, ride?.status]);

  // Existing rating prüfen
  useEffect(() => {
    if (!id || !ride || ride.status !== 'delivered') return;
    if (ride.rating) {
      setExistingRating({ rating: ride.rating, comment: ride.rating_comment });
      return;
    }
    apiFetch(`/api/rides/${id}/rating`)
      .then((data) => {
        if (data.rating) {
          setExistingRating({ rating: data.rating, comment: data.rating_comment });
        }
      })
      .catch(() => {});
  }, [id, ride?.status]);

  // Fahrer-Profil laden wenn zugewiesen
  useEffect(() => {
    if (!ride?.driver_id) return;
    apiFetch(`/api/auth/profile/${ride.driver_id}`)
      .then((data) => {
        if (data.profile) setDriverProfile(data.profile);
      })
      .catch(() => {});
    apiFetch(`/api/drivers/${ride.driver_id}/reviews?limit=1`)
      .then((data) => {
        setDriverReviewCount(data.total_reviews || 0);
      })
      .catch(() => {});
  }, [ride?.driver_id]);

  // Driver reviews laden für Modal
  const loadReviews = useCallback((page: number) => {
    if (!ride?.driver_id) return;
    setReviewsLoading(true);
    apiFetch(`/api/drivers/${ride.driver_id}/reviews?page=${page}&limit=10`)
      .then((data) => {
        if (page === 1) setDriverReviews(data.reviews || []);
        else setDriverReviews((prev) => [...prev, ...(data.reviews || [])]);
        setReviewsTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [ride?.driver_id]);

  // Ticker: Sekunden seit letztem Ping
  useEffect(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (lastPingTime !== null) {
        setSecondsSinceLastPing(Math.floor((Date.now() - lastPingTime) / 1000));
      }
    }, 1000);
    return () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    };
  }, [lastPingTime]);

  // Socket.io Verbindung
  useEffect(() => {
    if (!id) return;
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();

      socket.emit('ride:subscribe', { rideId: id });

      socket.on('ride:accepted', (data: { ride: Ride }) => {
        setRide(data.ride);
      });

      socket.on('ride:status_update', (data: { rideId: string; status: string; delivery_photo_url?: string }) => {
        if (data.rideId === id) {
          setRide((prev) => prev ? {
            ...prev,
            status: data.status,
            ...(data.delivery_photo_url ? { delivery_photo_url: data.delivery_photo_url } : {}),
          } : prev);
        }
      });

      socket.on('driver:location_update', (data: { rideId: string; lat?: number; lng?: number; latitude?: number; longitude?: number }) => {
        if (data.rideId !== id) return;
        const lat = data.lat ?? data.latitude ?? 0;
        const lng = data.lng ?? data.longitude ?? 0;
        const now = Date.now();

        setDriverLocation({ lat, lng });
        setLastPingTime(now);
        setSecondsSinceLastPing(0);
        setLocationPings((prev) => {
          const newPing: LocationPing = { lat, lng, timestamp: now };
          const updated = [...prev, newPing];
          return updated.slice(-MAX_PINGS);
        });
      });
    } catch {
      // Socket nicht verfügbar
    }

    return () => {
      disconnectSocket();
    };
  }, [id]);

  async function handleSubmitRating() {
    if (!selectedRating || ratingLoading || ratingSubmitted) return;
    setRatingLoading(true);
    setRatingError('');
    try {
      const data = await apiFetch(`/api/rides/${id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating: selectedRating, comment: ratingComment || undefined }),
      });
      if (data.error) throw new Error(data.error);
      setRatingSubmitted(true);
      setExistingRating({ rating: selectedRating, comment: ratingComment });
      setRide((prev) => prev ? { ...prev, rating: selectedRating } : prev);
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : 'Bewertung fehlgeschlagen');
    } finally {
      setRatingLoading(false);
    }
  }

  async function handleCancel() {
    if (!ride || cancelling) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/rides/${id}/cancel`, { method: 'PATCH' });
      setRide((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    } finally {
      setCancelling(false);
    }
  }

  function openDriverModal() {
    setShowDriverModal(true);
    setReviewsPage(1);
    loadReviews(1);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-error text-center">{error || 'Auftrag nicht gefunden'}</p>
        <Link href="/dashboard" className="text-primary font-semibold">← Zurück</Link>
      </div>
    );
  }

  const isActive = ['pending', 'accepted', 'picked_up', 'scheduled'].includes(ride.status);
  const isScheduled = ride.status === 'scheduled' && ride.is_scheduled;
  const isDelivered = ride.status === 'delivered';
  const isExpired = ride.status === 'expired';
  const isRikscha = ['rikscha_taxi', 'rikscha_tour'].includes(ride.service_type || '');
  const isTour = ride.service_type === 'rikscha_tour';

  // Fahrer-Position nur anzeigen wenn: Sofort-Auftrag ODER geplanter Zeitpunkt < 10 Min entfernt
  const isScheduledAndFar = ride.is_scheduled && ride.scheduled_at && ride.status === 'accepted'
    && (new Date(ride.scheduled_at).getTime() - Date.now()) > 10 * 60 * 1000;
  const showDriverTracking = !isScheduledAndFar;
  const hasExistingRating = !!(existingRating || ride.rating);
  const displayRating = existingRating?.rating || ride.rating || 0;
  const displayComment = existingRating?.comment || ride.rating_comment || '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 shadow-sm flex items-center gap-3">
        <Link href="/dashboard">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </Link>
        <div>
          <h1 className="font-heading text-lg font-bold text-radler-ink-800">
            {isRikscha ? (isTour ? '🗺 Tour verfolgen' : '🛺 Fahrt verfolgen') : 'Auftrag verfolgen'}
          </h1>
          <p className="text-xs text-gray-500">{getStatusLabel(ride.status)}</p>
        </div>
      </div>

      {/* Karte */}
      <div className="px-4 pt-4">
        <Map
          markers={[
            { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), color: '#22C55E', label: 'A' },
            { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng), color: '#EF4444', label: 'B' },
          ]}
          driverLocation={showDriverTracking ? driverLocation : null}
          locationPings={showDriverTracking ? locationPings : []}
          className="h-64"
        />
        {showDriverTracking && secondsSinceLastPing !== null && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs text-gray-500">
              Letzte Position: vor {secondsSinceLastPing === 0 ? 'wenigen' : secondsSinceLastPing} Sekunden
            </p>
          </div>
        )}
        {showDriverTracking && locationPings.length === 0 && ['accepted', 'picked_up'].includes(ride.status) && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-xs text-gray-500">Warte auf Fahrer-Position...</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white mx-4 mt-4 rounded-3xl shadow-sm">
        <StatusBar status={ride.status as Parameters<typeof StatusBar>[0]['status']} />
      </div>

      {/* Scheduled Countdown */}
      {isScheduled && ride.scheduled_at && (
        <div className="mx-4 mt-3 bg-purple-50 border border-purple-100 rounded-3xl p-5 shadow-sm text-center">
          <span className="text-3xl block mb-2">📅</span>
          <p className="text-sm font-semibold text-purple-800 mb-1">Geplante Lieferung</p>
          <p className="text-xs text-purple-600 mb-3">
            {new Date(ride.scheduled_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' um '}
            {new Date(ride.scheduled_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
          <div className="bg-white rounded-2xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Countdown</p>
            <p className="text-2xl font-black text-purple-700 font-mono">{countdown || '...'}</p>
          </div>
          <p className="text-xs text-purple-500 mt-3">
            30 Minuten vorher wird ein Kurier gesucht
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-white mx-4 mt-3 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">{isRikscha ? 'Treffpunkt' : 'Abholung'}</p>
            <p className="text-sm text-gray-900">{ride.pickup_address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">{isTour ? 'Endpunkt' : 'Ziel'}</p>
            <p className="text-sm text-gray-900">{ride.dropoff_address}</p>
          </div>
        </div>

        {/* Rikscha-Info */}
        {isRikscha && (
          <div className="pt-2 border-t border-gray-100 flex gap-3">
            <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-xs text-gray-400">Fahrgäste</p>
              <p className="text-sm font-bold">{ride.passenger_count || 1} Pers.</p>
            </div>
            {isTour && ride.tour_duration_hours && (
              <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-xs text-gray-400">Tour-Dauer</p>
                <p className="text-sm font-bold">{ride.tour_duration_hours} Std.</p>
              </div>
            )}
            <div className="flex-1 bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-xs text-gray-400">Fahrzeug</p>
              <p className="text-sm font-bold">
                {ride.vehicle_type === 'rikscha' ? '🛺 Rikscha'
                  : ride.vehicle_type === 'rikscha_xl' ? '🛺 XL'
                  : ride.vehicle_type === 'tandem' ? '🚲🚲 Tandem'
                  : ride.vehicle_type}
              </p>
            </div>
          </div>
        )}

        {/* Übergabe-Infos — nur für Kurier */}
        {!isRikscha && ride.pickup_method && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Abholung</p>
              {ride.pickup_code_confirmed && <span className="text-xs text-green-600 font-semibold">✓ Bestätigt</span>}
              {ride.pickup_method === 'photo' && ride.pickup_photo_url && <span className="text-xs text-green-600 font-semibold">✓ Foto</span>}
            </div>
            {ride.pickup_method === 'code' ? (
              <p className="text-lg font-black text-gray-900 tracking-[0.3em] mt-1">{ride.pickup_code}</p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Per Foto-Nachweis</p>
            )}
          </div>
        )}
        {!isRikscha && ride.delivery_method && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Zustellung</p>
              {ride.delivery_code_confirmed && <span className="text-xs text-green-600 font-semibold">✓ Bestätigt</span>}
              {ride.delivery_method === 'photo' && ride.delivery_photo_url && <span className="text-xs text-green-600 font-semibold">✓ Foto</span>}
            </div>
            {ride.delivery_method === 'code' ? (
              <p className="text-lg font-black text-gray-900 tracking-[0.3em] mt-1">{ride.delivery_code}</p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Per Foto-Nachweis</p>
            )}
          </div>
        )}
      </div>

      {/* Hinweis bei geplanten Aufträgen: Tracking startet erst kurz vorher */}
      {isScheduledAndFar && ride.driver_name && (
        <div className="mx-4 mt-3 bg-blue-50 border border-blue-100 rounded-3xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {ride.driver_name} hat den Auftrag angenommen
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Live-Tracking startet 10 Minuten vor der geplanten Abholung.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fahrer-Profil Card */}
      {ride.driver_id && driverProfile && ['accepted', 'picked_up', 'delivered'].includes(ride.status) && (
        <button
          onClick={openDriverModal}
          className="mx-4 mt-3 bg-white rounded-3xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors w-[calc(100%-2rem)]"
        >
          <div className="flex items-center gap-3">
            {driverProfile.profile_image_url ? (
              <img
                src={`${apiBase}${driverProfile.profile_image_url}`}
                alt={driverProfile.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">{driverProfile.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{driverProfile.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {driverProfile.rating && (
                  <>
                    <span className="text-xs font-bold text-gray-700">{Number(driverProfile.rating).toFixed(1)}</span>
                    <span className="text-yellow-400 text-xs">★</span>
                    {driverReviewCount > 0 && (
                      <span className="text-xs text-gray-400">({driverReviewCount})</span>
                    )}
                    <span className="text-gray-300 mx-1">·</span>
                  </>
                )}
                <span className="text-xs text-gray-500">
                  {driverProfile.vehicle_type === 'bicycle' ? '🚲 Fahrrad'
                    : driverProfile.vehicle_type === 'cargo_bike' ? '🚛 Lastenrad'
                    : driverProfile.vehicle_type === 'rikscha' ? '🛺 Rikscha'
                    : driverProfile.vehicle_type === 'rikscha_xl' ? '🛺 Rikscha XL'
                    : driverProfile.vehicle_type === 'tandem' ? '🚲🚲 Tandem'
                    : '🚲 Fahrrad'}
                </span>
              </div>
              {driverProfile.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{driverProfile.description}</p>
              )}
            </div>
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Fallback: Fahrer-Name ohne Profil */}
      {ride.driver_name && !driverProfile && ['accepted', 'picked_up'].includes(ride.status) && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg">
                {ride.vehicle_type === 'rikscha' || ride.vehicle_type === 'rikscha_xl' ? '🛺'
                  : ride.vehicle_type === 'tandem' ? '🚲🚲'
                  : ride.vehicle_type === 'cargo_bike' ? '🚛'
                  : '🚲'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400">{isRikscha ? 'Dein Fahrer' : 'Dein Kurier'}</p>
              <p className="text-sm font-semibold text-gray-900">{ride.driver_name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Zugestellt + Bewertung */}
      {isDelivered && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-5 shadow-sm">
          {/* Zugestellt Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900">
                {isRikscha ? 'Deine Fahrt ist beendet!' : 'Dein Paket wurde zugestellt!'}
              </p>
              <p className="text-xs text-gray-500">
                {isRikscha ? (isTour ? 'Tour erfolgreich abgeschlossen' : 'Fahrt erfolgreich abgeschlossen') : 'Lieferung erfolgreich abgeschlossen'}
              </p>
            </div>
          </div>

          {/* Ablieferungsfoto */}
          {ride.delivery_photo_url && (
            <img
              src={`${apiBase}${ride.delivery_photo_url}`}
              alt="Ablieferungsfoto"
              className="w-full rounded-2xl object-cover max-h-48 mb-4"
            />
          )}

          {/* Bewertung: schon bewertet */}
          {hasExistingRating || ratingSubmitted ? (
            <div className="text-center py-2">
              <div className="flex justify-center gap-1 mb-2">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-3xl ${s <= displayRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
              {displayComment && (
                <p className="text-sm text-gray-500 italic mb-2">&ldquo;{displayComment}&rdquo;</p>
              )}
              <p className="text-sm font-semibold text-green-600">Danke für deine Bewertung!</p>
            </div>
          ) : (
            <>
              {/* Bewertung: Formular */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-1 text-center">
                  {isRikscha ? 'Wie war deine Fahrt?' : 'Wie war dein Kurier?'}
                </p>
                <p className="text-xs text-gray-400 text-center mb-4">
                  {isRikscha ? 'Bewerte die Fahrt' : 'Bewerte die Lieferung'}
                </p>

                <div className="flex justify-center gap-3 mb-4">
                  {[1,2,3,4,5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedRating(s)}
                      disabled={ratingLoading}
                      className="p-1 transition-transform active:scale-90 disabled:opacity-50"
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <span className={`text-4xl ${s <= selectedRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    </button>
                  ))}
                </div>

                {selectedRating > 0 && (
                  <>
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value.substring(0, 500))}
                      placeholder="Möchtest du etwas dazu sagen? (optional)"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none mb-1"
                    />
                    <p className="text-right text-xs text-gray-300 mb-3">{ratingComment.length}/500</p>

                    {ratingError && (
                      <p className="text-center text-sm text-red-500 mb-3">{ratingError}</p>
                    )}

                    <button
                      onClick={handleSubmitRating}
                      disabled={ratingLoading}
                      className="w-full bg-green-500 text-white font-semibold py-4 rounded-2xl active:bg-green-600 disabled:opacity-50 transition-colors mb-2"
                    >
                      {ratingLoading ? 'Wird gesendet...' : 'Bewertung abschicken'}
                    </button>
                    <button
                      onClick={() => setSelectedRating(0)}
                      className="w-full text-gray-400 text-sm py-2"
                    >
                      Überspringen
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Abhol-Foto — nur für Kurier */}
      {!isRikscha && ride.pickup_photo_url && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">Abholung dokumentiert:</p>
          <img
            src={`${apiBase}${ride.pickup_photo_url}`}
            alt="Abholungsfoto"
            className="w-full rounded-2xl object-cover max-h-64"
          />
        </div>
      )}

      {/* Abgelaufen */}
      {isExpired && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-5 shadow-sm text-center">
          <div className="text-5xl mb-3">😔</div>
          <p className="font-bold text-gray-900 mb-1">
            {isRikscha ? 'Kein Fahrer gefunden' : 'Kein Kurier gefunden'}
          </p>
          <p className="text-sm text-gray-500 mb-5">
            {isRikscha
              ? 'Leider konnte innerhalb von 10 Minuten kein verfügbarer Fahrer gefunden werden.'
              : 'Leider konnte innerhalb von 10 Minuten kein verfügbarer Kurier gefunden werden.'}
          </p>
          <Link href="/book">
            <button className="w-full bg-primary text-primary-fg font-semibold py-4 rounded-2xl active:bg-primary-dark mb-3">
              Erneut versuchen
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="w-full bg-gray-100 text-gray-600 font-semibold py-3.5 rounded-2xl active:bg-gray-200">
              Zurück zur Übersicht
            </button>
          </Link>
        </div>
      )}

      <div className="flex-1" />

      {/* Stornieren */}
      {isActive && (
        <div className="px-4 pb-8 mt-4">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full border-2 border-error text-error font-semibold py-3.5 rounded-2xl active:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {cancelling ? 'Stornieren...' : (isRikscha ? 'Fahrt stornieren' : 'Auftrag stornieren')}
          </button>
        </div>
      )}

      {isDelivered && (
        <div className="px-4 pb-8 mt-4">
          <Link href="/dashboard">
            <button className="w-full bg-primary text-primary-fg font-semibold py-4 rounded-2xl active:bg-primary-dark">
              Zurück zur Übersicht
            </button>
          </Link>
        </div>
      )}

      {/* Fahrer-Profil Modal */}
      {showDriverModal && driverProfile && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDriverModal(false)} />
          <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowDriverModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center z-10"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pb-8 space-y-5">
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
                  <p className="text-sm font-bold mt-0.5">
                    {driverProfile.vehicle_type === 'bicycle' ? '🚲 Fahrrad'
                      : driverProfile.vehicle_type === 'cargo_bike' ? '🚛 Lastenrad'
                      : driverProfile.vehicle_type === 'rikscha' ? '🛺 Rikscha'
                      : driverProfile.vehicle_type === 'rikscha_xl' ? '🛺 XL'
                      : driverProfile.vehicle_type === 'tandem' ? '🚲🚲 Tandem'
                      : '🚲 Fahrrad'}
                  </p>
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

                {reviewsPage < reviewsTotalPages && (
                  <button
                    onClick={() => {
                      const next = reviewsPage + 1;
                      setReviewsPage(next);
                      loadReviews(next);
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
