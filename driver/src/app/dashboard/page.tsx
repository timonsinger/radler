'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, User } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useGeolocation } from '@/hooks/useGeolocation';
import OnlineToggle from '@/components/OnlineToggle';
import StatsCard from '@/components/StatsCard';
import Map from '@/components/Map';
import RideRequest from '@/components/RideRequest';
import ActiveRide from '@/components/ActiveRide';
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
  distance_km: number;
  price: number;
  driver_payout?: number;
  vehicle_type: string;
  customer_name?: string;
  pickup_method?: string;
  pickup_code_confirmed?: boolean;
  pickup_photo_url?: string;
  delivery_method?: string;
  delivery_code_confirmed?: boolean;
  delivery_photo_url?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  useInactivityLogout();
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [pendingRide, setPendingRide] = useState<Ride | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [maxPickupRadius, setMaxPickupRadius] = useState(10);
  const [maxRideDistance, setMaxRideDistance] = useState(20);
  const [ratingToast, setRatingToast] = useState<{ rating: number; comment?: string } | null>(null);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [isApproved, setIsApproved] = useState(true);
  const [approvalToast, setApprovalToast] = useState<string | null>(null);
  const [rejectionAlert, setRejectionAlert] = useState<string | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOnlineRef = useRef(false);

  // Ref synchron halten für den reconnect-Handler
  isOnlineRef.current = isOnline;

  // GPS nur aktiv wenn online oder aktiver Ride
  const trackingActive = isOnline || !!activeRide;
  const { position, error: gpsError } = useGeolocation(trackingActive);

  const driverLocation = useMemo(
    () => position ? { lat: position.latitude, lng: position.longitude } : null,
    [position]
  );

  // Init: User laden, Online-Status + Einstellungen laden
  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }
    setUser(stored);

    apiFetch('/api/auth/me')
      .then((data) => {
        if (data.driver?.is_online) setIsOnline(true);
        if (data.driver && !data.driver.onboarding_completed) setShowOnboardingBanner(true);
        if (data.driver) setIsApproved(!!data.driver.is_approved);
        return Promise.all([
          apiFetch('/api/rides'),
          apiFetch('/api/drivers/settings'),
        ]);
      })
      .then(([ridesData, settingsData]) => {
        const rides: Ride[] = ridesData.rides || [];
        const active = rides.find((r) => ['accepted', 'picked_up'].includes(r.status));
        if (active) setActiveRide(active);
        if (settingsData.max_pickup_radius_km) setMaxPickupRadius(settingsData.max_pickup_radius_km);
        if (settingsData.max_ride_distance_km) setMaxRideDistance(settingsData.max_ride_distance_km);
      })
      .catch(console.error);
  }, [router]);

  // Socket.io verbinden wenn User geladen (nur einmal, nicht bei activeRide-Änderung)
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const handleRideNew = (data: { ride: Ride }) => {
      setPendingRide((prev) => prev ?? data.ride);
    };
    const handleRideRemoved = (data: { rideId: string }) => {
      setPendingRide((prev) => prev?.id === data.rideId ? null : prev);
    };
    const handleStatusUpdate = (data: { rideId: string; status: string }) => {
      if (data.status === 'cancelled' || data.status === 'expired') {
        setActiveRide((prev) => (prev?.id === data.rideId ? null : prev));
        setPendingRide((prev) => (prev?.id === data.rideId ? null : prev));
      }
    };

    // Bei Reconnect: wenn Fahrer online war, Room neu betreten
    const handleReconnect = () => {
      if (isOnlineRef.current) {
        socket.emit('driver:go_online');
      }
    };

    const handleRideRated = (data: { rideId: string; rating: number; comment?: string }) => {
      setRatingToast({ rating: data.rating, comment: data.comment });
      setTimeout(() => setRatingToast(null), 5000);
    };

    const handleDriverApproved = () => {
      setIsApproved(true);
      setApprovalToast('Dein Account wurde freigeschaltet! Du kannst jetzt online gehen.');
      setTimeout(() => setApprovalToast(null), 6000);
    };

    const handleDriverRejected = (data: { reason: string }) => {
      setIsApproved(false);
      setRejectionAlert(`Dein Account wurde abgelehnt. Grund: ${data.reason}. Bitte kontaktiere uns.`);
    };

    const handleForcedOffline = (data: { reason: string }) => {
      setIsOnline(false);
      setPendingRide(null);
      setApprovalToast(data.reason || 'Du wurdest vom Admin offline geschaltet');
      setTimeout(() => setApprovalToast(null), 6000);
    };

    socket.on('ride:new', handleRideNew);
    socket.on('ride:removed', handleRideRemoved);
    socket.on('ride:status_update', handleStatusUpdate);
    socket.on('connect', handleReconnect);
    socket.on('ride:rated', handleRideRated);
    socket.on('driver:approved', handleDriverApproved);
    socket.on('driver:rejected', handleDriverRejected);
    socket.on('driver:forced_offline', handleForcedOffline);

    return () => {
      socket.off('ride:new', handleRideNew);
      socket.off('ride:removed', handleRideRemoved);
      socket.off('ride:status_update', handleStatusUpdate);
      socket.off('connect', handleReconnect);
      socket.off('ride:rated', handleRideRated);
      socket.off('driver:approved', handleDriverApproved);
      socket.off('driver:rejected', handleDriverRejected);
      socket.off('driver:forced_offline', handleForcedOffline);
      disconnectSocket();
    };
  }, [user]); // activeRide bewusst entfernt - kein disconnect bei Ride-Änderungen

  // GPS Position alle 3 Sekunden ans Backend senden
  useEffect(() => {
    if (!position || !trackingActive) return;

    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);

    locationIntervalRef.current = setInterval(() => {
      apiFetch('/api/drivers/location', {
        method: 'PATCH',
        body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude }),
      }).catch(console.error);

      try {
        const socket = getSocket();
        socket.emit('driver:location', { lat: position.latitude, lng: position.longitude });
      } catch { /* ignorieren */ }
    }, 3000);

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [position, trackingActive]);

  // Online/Offline Toggle
  const handleToggle = useCallback(async () => {
    setToggleLoading(true);
    try {
      const newStatus = !isOnline;

      // Einstellungen vor dem Online-Gehen speichern
      if (newStatus) {
        await apiFetch('/api/drivers/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            max_pickup_radius_km: maxPickupRadius,
            max_ride_distance_km: maxRideDistance,
          }),
        });
      }

      await apiFetch('/api/drivers/status', {
        method: 'PATCH',
        body: JSON.stringify({ is_online: newStatus }),
      });

      const socket = getSocket();
      if (newStatus) {
        socket.emit('driver:go_online');
        setIsOnline(true);
      } else {
        socket.emit('driver:go_offline');
        setIsOnline(false);
        setPendingRide(null);
      }
    } catch (err: any) {
      if (err.message?.includes('nicht freigeschaltet') || err.message?.includes('403')) {
        setIsApproved(false);
      }
      console.error('Toggle fehlgeschlagen:', err);
    } finally {
      setToggleLoading(false);
    }
  }, [isOnline, maxPickupRadius, maxRideDistance]);

  // Auftrag annehmen
  async function handleAccept() {
    if (!pendingRide) return;
    setAccepting(true);
    try {
      const data = await apiFetch(`/api/rides/${pendingRide.id}/accept`, { method: 'PATCH' });
      if (data.error) throw new Error(data.error);
      setActiveRide({ ...pendingRide, status: 'accepted' });
      setPendingRide(null);
    } catch (err) {
      console.error('Annehmen fehlgeschlagen:', err);
    } finally {
      setAccepting(false);
    }
  }

  // Status-Update (picked_up / delivered)
  function handleStatusUpdate(newStatus: string) {
    if (newStatus === 'delivered') {
      setDelivered(true);
      setTimeout(() => {
        setDelivered(false);
        setActiveRide(null);
      }, 3000);
    } else {
      setActiveRide((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Zustand: Auftrag zugestellt
  if (delivered) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 text-center">
        <div className="text-8xl mb-6">✅</div>
        <h2 className="text-3xl font-black text-white mb-2">Zugestellt!</h2>
        {activeRide && (
          <p className="text-2xl font-bold text-white/90 mb-1">+{Number(activeRide.driver_payout || activeRide.price * 0.85).toFixed(2).replace('.', ',')} €</p>
        )}
        <p className="text-white/70">Auftrag erfolgreich abgeschlossen.</p>
        <p className="text-white/50 text-sm mt-2">Gleich zurück...</p>
      </div>
    );
  }

  // Zustand: Aktiver Auftrag
  if (activeRide) {
    return (
      <>
        <ActiveRide
          ride={activeRide}
          driverLocation={driverLocation}
          onStatusUpdate={handleStatusUpdate}
          userName={user.name}
        />
        {pendingRide && (
          <RideRequest
            ride={pendingRide}
            onAccept={handleAccept}
            onDecline={() => setPendingRide(null)}
            accepting={accepting}
          />
        )}
      </>
    );
  }

  // Zustand: Normal (Online/Offline)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Fahrer-App</p>
            <h1 className="text-xl font-black text-white">{user.name}</h1>
          </div>
          <a
            href="/profile"
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 pb-8 gap-5">
        {/* Onboarding Banner */}
        {showOnboardingBanner && (
          <a
            href="/onboarding"
            className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-yellow-100 transition-colors"
          >
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-yellow-800">Fahrer-Anleitung lesen</p>
              <p className="text-xs text-yellow-600">Gewerbe, Versicherung & mehr – bevor du loslegst</p>
            </div>
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        )}

        {/* Approval Pending Banner */}
        {!isApproved && !showOnboardingBanner && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-sm font-bold text-blue-800">Dein Account wird geprüft</p>
                <p className="text-xs text-blue-600 mt-0.5">Du wirst benachrichtigt sobald du freigeschaltet bist.</p>
              </div>
            </div>
          </div>
        )}

        {/* Online/Offline Toggle + Karte */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {/* Karte wenn online */}
          {isOnline && (
            <Map
              driverLocation={driverLocation}
              radiusKm={maxPickupRadius}
              className="h-48 rounded-none"
            />
          )}
          <div className="py-7 flex flex-col items-center gap-2">
            <OnlineToggle
              isOnline={isOnline}
              onToggle={handleToggle}
              loading={toggleLoading}
              disabled={!isApproved}
            />
            {!isApproved && (
              <p className="text-xs text-gray-400 mt-1">Freischaltung ausstehend</p>
            )}
          </div>

          {/* Einstellungen wenn offline */}
          {!isOnline && (
            <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Einstellungen</p>

              {/* Max. Abholradius */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Max. Abholradius</label>
                  <span className="text-sm font-bold text-primary">{maxPickupRadius} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={0.5}
                  value={maxPickupRadius}
                  onChange={(e) => setMaxPickupRadius(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>30 km</span>
                </div>
              </div>

              {/* Max. Fahrtdistanz */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Max. Fahrtdistanz</label>
                  <span className="text-sm font-bold text-primary">{maxRideDistance} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={0.5}
                  value={maxRideDistance}
                  onChange={(e) => setMaxRideDistance(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span>
                  <span>50 km</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tagesstatistik */}
        <StatsCard />

        {/* Info-Text */}
        {isOnline && (
          <>
            {gpsError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <div>
                  <p className="text-sm text-red-700 font-semibold">GPS nicht verfügbar</p>
                  <p className="text-xs text-red-500 mt-0.5">{gpsError}</p>
                  <p className="text-xs text-red-500 mt-1">
                    Einstellungen → Safari → Ortungsdienste → aktivieren
                  </p>
                </div>
              </div>
            ) : !driverLocation ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse flex-shrink-0" />
                <p className="text-sm text-yellow-700 font-medium">
                  GPS wird gesucht…
                </p>
              </div>
            ) : (
              <div className="bg-primary-bg border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-online animate-pulse flex-shrink-0" />
                <p className="text-sm text-primary font-medium">
                  GPS aktiv – neue Aufträge werden angezeigt
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Eingehender Auftrag (Overlay) */}
      {pendingRide && (
        <RideRequest
          ride={pendingRide}
          onAccept={handleAccept}
          onDecline={() => setPendingRide(null)}
          accepting={accepting}
        />
      )}

      {/* Approval Toast */}
      {approvalToast && (
        <div className="fixed top-14 left-4 right-4 z-50 animate-slide-down">
          <div className="bg-green-50 border border-green-200 rounded-2xl shadow-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <p className="text-sm font-semibold text-green-800 flex-1">{approvalToast}</p>
            <button onClick={() => setApprovalToast(null)} className="text-green-400 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Rejection Alert */}
      {rejectionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl max-w-sm mx-4 p-6 shadow-2xl text-center">
            <span className="text-4xl">❌</span>
            <p className="text-sm text-gray-700 mt-3">{rejectionAlert}</p>
            <button onClick={() => setRejectionAlert(null)} className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl">
              OK
            </button>
          </div>
        </div>
      )}

      {/* Bewertungs-Toast */}
      {ratingToast && (
        <div className="fixed top-14 left-4 right-4 z-50 animate-slide-down">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⭐</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Neue Bewertung</p>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-sm ${s <= ratingToast.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            </div>
            <button onClick={() => setRatingToast(null)} className="text-gray-300 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
