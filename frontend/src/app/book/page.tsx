'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { calculatePrice, formatPrice } from '@/lib/maps';
import AddressInput from '@/components/AddressInput';
import VehicleSelector from '@/components/VehicleSelector';
import PriceDisplay from '@/components/PriceDisplay';
import Map from '@/components/Map';
import NavBar from '@/components/NavBar';

interface Location {
  address: string;
  lat: number;
  lng: number;
}

interface AvailableDriver {
  id: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  rating?: number;
}

type Step = 1 | 2 | 3 | 4;
type VehicleType = 'bicycle' | 'cargo_bike';

export default function BookPage() {
  const router = useRouter();
  const user = getStoredUser();

  const [step, setStep] = useState<Step>(1);
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'pickup' | 'dropoff' | null>(null);
  const [showPickupInvite, setShowPickupInvite] = useState(false);
  const [showDropoffInvite, setShowDropoffInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const socketSubscribedRef = useRef<VehicleType | null>(null);

  // Standort beim Laden automatisch setzen
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({
          address: 'Mein Standort',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {}
    );
  }, []);

  // Verfügbare Fahrer laden (REST) – initialer Load
  useEffect(() => {
    const vt = vehicleType || 'bicycle';
    apiFetch(`/api/drivers/available?vehicle_type=${vt}`)
      .then((data) => {
        if (data.drivers) setAvailableDrivers(data.drivers);
      })
      .catch(() => {});
  }, [vehicleType]);

  // WebSocket: Fahrer-Positionen abonnieren
  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      socket = getSocket();
      const vt = vehicleType || 'bicycle';

      // Altes Abo kündigen
      if (socketSubscribedRef.current && socketSubscribedRef.current !== vt) {
        socket.emit('drivers:unsubscribe');
      }

      socket.emit('drivers:subscribe', { vehicle_type: vt });
      socketSubscribedRef.current = vt;

      socket.on('drivers:positions', (data: { drivers: AvailableDriver[] }) => {
        setAvailableDrivers(data.drivers);
      });
    } catch { /* nicht eingeloggt */ }

    return () => {
      if (socket) {
        socket.off('drivers:positions');
        socket.emit('drivers:unsubscribe');
      }
    };
  }, [vehicleType]);

  const handleRouteCalculated = useCallback((km: number) => {
    setDistanceKm(km);
  }, []);

  async function handleBook() {
    if (!pickup || !dropoff || !vehicleType) return;
    setError('');
    setLoading(true);
    try {
      const price = calculatePrice(vehicleType, distanceKm);
      const data = await apiFetch('/api/rides', {
        method: 'POST',
        body: JSON.stringify({
          pickup_address: pickup.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_address: dropoff.address,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
          vehicle_type: vehicleType,
          distance_km: distanceKm,
          price,
          invite_email: inviteEmail || undefined,
          invite_role: inviteRole || undefined,
        }),
      });
      if (data.error) throw new Error(data.error);
      disconnectSocket();
      router.replace(`/track/${data.ride.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Buchen');
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation(forStep: 'pickup' | 'dropoff') {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { address: 'Mein Standort', lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (forStep === 'pickup') setPickup(loc);
      else setDropoff(loc);
    });
  }

  const stepTitles = ['Abholort', 'Zielort', 'Fahrzeug', 'Zusammenfassung'];
  const driverCount = availableDrivers.length;
  const showDrivers = step <= 4;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
          <img src="/radler_logo.svg" alt="Radler" className="h-7 w-auto" />
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {stepTitles.map((title, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i + 1 < step ? 'bg-primary text-primary-fg' : i + 1 === step ? 'bg-primary text-primary-fg' : 'bg-gray-200 text-gray-400'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              {i < stepTitles.length - 1 && (
                <div className={`flex-1 h-0.5 ${i + 1 < step ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-primary mt-2">{stepTitles[step - 1]}</p>
      </div>

      <div className="px-4 pt-5">
        {/* Schritt 1: Abholort */}
        {step === 1 && (
          <div className="space-y-4">
            {pickup && (
              <div className="relative">
                <Map
                  markers={[{ lat: pickup.lat, lng: pickup.lng, color: '#22C55E', label: 'A' }]}
                  availableDrivers={showDrivers ? availableDrivers : []}
                  className="h-44"
                />
                {driverCount > 0 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-primary shadow">
                    {driverCount} {driverCount === 1 ? 'Fahrer' : 'Fahrer'} in deiner Nähe
                  </div>
                )}
              </div>
            )}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Abholadresse</label>
              <AddressInput
                placeholder="Adresse eingeben..."
                value={pickup?.address || ''}
                onSelect={setPickup}
              />
              <button
                onClick={() => useMyLocation('pickup')}
                className="mt-3 flex items-center gap-2 text-primary text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mein Standort verwenden
              </button>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <button
                onClick={() => setShowPickupInvite(!showPickupInvite)}
                className="flex items-center justify-between w-full"
              >
                <span className="text-sm font-medium text-gray-700">Andere Person als Abholer</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${showPickupInvite ? 'bg-primary' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform shadow ${showPickupInvite ? 'translate-x-5 ml-0' : 'translate-x-1'}`} />
                </div>
              </button>
              {showPickupInvite && (
                <div className="mt-3">
                  <input
                    type="email"
                    placeholder="E-Mail der Abholperson"
                    value={inviteRole === 'pickup' ? inviteEmail : ''}
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteRole('pickup'); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!pickup}
              className="w-full bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
            >
              Weiter →
            </button>
          </div>
        )}

        {/* Schritt 2: Zielort */}
        {step === 2 && (
          <div className="space-y-4">
            {(pickup || dropoff) && (
              <div className="relative">
                <Map
                  markers={[
                    ...(pickup ? [{ lat: pickup.lat, lng: pickup.lng, color: '#22C55E', label: 'A' }] : []),
                    ...(dropoff ? [{ lat: dropoff.lat, lng: dropoff.lng, color: '#EF4444', label: 'B' }] : []),
                  ]}
                  availableDrivers={showDrivers ? availableDrivers : []}
                  className="h-44"
                />
                {driverCount > 0 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-primary shadow">
                    {driverCount} Fahrer in deiner Nähe
                  </div>
                )}
              </div>
            )}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zieladresse</label>
              <AddressInput
                placeholder="Ziel eingeben..."
                value={dropoff?.address || ''}
                onSelect={setDropoff}
              />
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <button
                onClick={() => setShowDropoffInvite(!showDropoffInvite)}
                className="flex items-center justify-between w-full"
              >
                <span className="text-sm font-medium text-gray-700">Andere Person als Empfänger</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${showDropoffInvite ? 'bg-primary' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform shadow ${showDropoffInvite ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </button>
              {showDropoffInvite && (
                <div className="mt-3">
                  <input
                    type="email"
                    placeholder="E-Mail des Empfängers"
                    value={inviteRole === 'dropoff' ? inviteEmail : ''}
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteRole('dropoff'); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl active:bg-gray-200">
                ← Zurück
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!dropoff}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* Schritt 3: Fahrzeug */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Fahrzeug wählen</h3>
              <VehicleSelector selected={vehicleType} onSelect={setVehicleType} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">
                ← Zurück
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!vehicleType}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* Schritt 4: Zusammenfassung */}
        {step === 4 && pickup && dropoff && vehicleType && (
          <div className="space-y-4">
            <div className="relative">
              <Map
                markers={[
                  { lat: pickup.lat, lng: pickup.lng, color: '#22C55E', label: 'A' },
                  { lat: dropoff.lat, lng: dropoff.lng, color: '#EF4444', label: 'B' },
                ]}
                showRoute
                onRouteCalculated={handleRouteCalculated}
                availableDrivers={availableDrivers}
                className="h-52"
              />
              {driverCount > 0 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-primary shadow">
                  {driverCount} Fahrer verfügbar
                </div>
              )}
            </div>

            <PriceDisplay vehicleType={vehicleType} distanceKm={distanceKm} />

            <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Abholung</p>
                  <p className="text-sm text-gray-900">{pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Ziel</p>
                  <p className="text-sm text-gray-900">{dropoff.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <span className="text-lg">{vehicleType === 'bicycle' ? '🚲' : '🚛'}</span>
                <p className="text-sm text-gray-600">{vehicleType === 'bicycle' ? 'Fahrradkurier' : 'Lastenrad'}</p>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <span className="text-lg">💵</span>
                <p className="text-sm text-gray-600">Bezahlung: Bar bei Lieferung</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-error text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">
                ← Zurück
              </button>
              <button
                onClick={handleBook}
                disabled={loading}
                className="flex-1 bg-primary text-primary-fg font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-60 active:bg-primary-dark transition-colors"
              >
                {loading ? 'Buchen...' : `Buchen – ${formatPrice(calculatePrice(vehicleType, distanceKm))}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <NavBar />
    </div>
  );
}
