'use client';

import { useEffect, useState, useRef } from 'react';
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
  driver_name?: string;
  customer_name?: string;
  delivery_photo_url?: string;
  rating?: number;
}

interface LocationPing {
  lat: number;
  lng: number;
  timestamp: number;
}

const MAX_PINGS = 10;

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
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      console.log('[Track] ride:subscribe gesendet für', id);

      socket.on('ride:accepted', (data: { ride: Ride }) => {
        console.log('[Track] ride:accepted empfangen', data.ride.id);
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

      // Fahrer Position Pings
      socket.on('driver:location_update', (data: { rideId: string; lat?: number; lng?: number; latitude?: number; longitude?: number }) => {
        console.log('[Track] driver:location_update empfangen', data);
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

  async function handleRating(stars: number) {
    if (ratingLoading || ratingSubmitted) return;
    setSelectedRating(stars);
    setRatingLoading(true);
    try {
      await apiFetch(`/api/rides/${id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating: stars }),
      });
      setRatingSubmitted(true);
      setRide((prev) => prev ? { ...prev, rating: stars } : prev);
    } catch {
      // ignorieren
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

  const isActive = ['pending', 'accepted', 'picked_up'].includes(ride.status);
  const isDelivered = ride.status === 'delivered';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
          <h1 className="text-lg font-bold text-gray-900">Auftrag verfolgen</h1>
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
          driverLocation={driverLocation}
          locationPings={locationPings}
          className="h-64"
        />
        {/* Letzte Position Anzeige */}
        {secondsSinceLastPing !== null && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-xs text-gray-500">
              Letzte Position: vor {secondsSinceLastPing === 0 ? 'wenigen' : secondsSinceLastPing} Sekunden
            </p>
          </div>
        )}
        {locationPings.length === 0 && ['accepted', 'picked_up'].includes(ride.status) && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-xs text-gray-500">
              Warte auf Fahrer-Position...
            </p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white mx-4 mt-4 rounded-3xl shadow-sm">
        <StatusBar status={ride.status as Parameters<typeof StatusBar>[0]['status']} />
      </div>

      {/* Info Box */}
      <div className="bg-white mx-4 mt-3 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Abholung</p>
            <p className="text-sm text-gray-900">{ride.pickup_address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400">Ziel</p>
            <p className="text-sm text-gray-900">{ride.dropoff_address}</p>
          </div>
        </div>

        {ride.driver_name && ['accepted', 'picked_up'].includes(ride.status) && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg">{ride.vehicle_type === 'bicycle' ? '🚲' : '🚛'}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Dein Kurier</p>
              <p className="text-sm font-semibold text-gray-900">{ride.driver_name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Zugestellt Banner */}
      {isDelivered && (
        <div className="mx-4 mt-3 bg-primary-light border border-primary/30 rounded-3xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl">✓</span>
          </div>
          <div>
            <p className="font-bold text-primary-dark">Zugestellt!</p>
            <p className="text-sm text-gray-600">Dein Paket wurde erfolgreich geliefert.</p>
          </div>
        </div>
      )}

      {/* Bewertung */}
      {isDelivered && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-5 shadow-sm">
          {ride.rating || ratingSubmitted ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex gap-1">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-3xl ${s <= (ride.rating || selectedRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
              <p className="text-sm font-semibold text-gray-700">Danke für deine Bewertung! 🙏</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-1 text-center">Wie war dein Kurier?</p>
              <p className="text-xs text-gray-400 text-center mb-4">Bewerte die Lieferung</p>
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleRating(s)}
                    onMouseEnter={() => setHoveredRating(s)}
                    onMouseLeave={() => setHoveredRating(0)}
                    disabled={ratingLoading}
                    className="text-4xl transition-transform active:scale-90 disabled:opacity-50"
                  >
                    <span className={s <= (hoveredRating || selectedRating) ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                  </button>
                ))}
              </div>
              {ratingLoading && <p className="text-center text-xs text-gray-400 mt-3">Wird gespeichert…</p>}
            </>
          )}
        </div>
      )}

      {/* Ablieferungsfoto */}
      {isDelivered && ride.delivery_photo_url && (
        <div className="mx-4 mt-3 bg-white rounded-3xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">Dein Paket wurde zugestellt:</p>
          <img
            src={`${apiBase}${ride.delivery_photo_url}`}
            alt="Ablieferungsfoto"
            className="w-full rounded-2xl object-cover max-h-64"
          />
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
            {cancelling ? 'Stornieren...' : 'Auftrag stornieren'}
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
    </div>
  );
}
