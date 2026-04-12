'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, logout, User } from '@/lib/auth';
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
  vehicle_type: string;
  customer_name?: string;
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
      if (data.status === 'cancelled') {
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

    socket.on('ride:new', handleRideNew);
    socket.on('ride:removed', handleRideRemoved);
    socket.on('ride:status_update', handleStatusUpdate);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('ride:new', handleRideNew);
      socket.off('ride:removed', handleRideRemoved);
      socket.off('ride:status_update', handleStatusUpdate);
      socket.off('connect', handleReconnect);
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
    } catch (err) {
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
          <button
            onClick={logout}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 pb-8 gap-5">
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
            />
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
    </div>
  );
}
