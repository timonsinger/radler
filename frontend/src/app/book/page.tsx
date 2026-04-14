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

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type VehicleType = 'bicycle' | 'cargo_bike';
type HandoverMethod = 'code' | 'photo';

function PinInput({ value, onChange, label, hint }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint: string;
}) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const digits = value.padEnd(4, '').split('').slice(0, 4);

  function handleChange(index: number, digit: string) {
    if (!/^\d?$/.test(digit)) return;
    const arr = [...digits];
    arr[index] = digit;
    onChange(arr.join(''));
    if (digit && index < 3) refs[index + 1].current?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      <div className="flex gap-3 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-14 h-16 text-center text-2xl font-black border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        ))}
      </div>
    </div>
  );
}

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

  // Übergabe-Optionen
  const [pickupMethod, setPickupMethod] = useState<HandoverMethod>('code');
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<HandoverMethod>('code');
  const [deliveryCode, setDeliveryCode] = useState('');

  // Zeitplanung
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Auftragsbeschreibung
  const [description, setDescription] = useState('');

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

  useEffect(() => {
    const vt = vehicleType || 'bicycle';
    apiFetch(`/api/drivers/available?vehicle_type=${vt}`)
      .then((data) => {
        if (data.drivers) setAvailableDrivers(data.drivers);
      })
      .catch(() => {});
  }, [vehicleType]);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      socket = getSocket();
      const vt = vehicleType || 'bicycle';
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

      // Geplante Lieferung: Datum + Uhrzeit zusammenbauen
      let scheduled_at: string | undefined;
      if (scheduleMode === 'later' && scheduledDate && scheduledTime) {
        scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

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
          pickup_method: pickupMethod,
          pickup_code: pickupMethod === 'code' ? pickupCode : undefined,
          delivery_method: deliveryMethod,
          delivery_code: deliveryMethod === 'code' ? deliveryCode : undefined,
          scheduled_at,
          description: description || undefined,
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

  const stepTitles = ['Abholort', 'Zielort', 'Fahrzeug', 'Übergabe', 'Zeitpunkt', 'Zusammenfassung'];
  const driverCount = availableDrivers.length;
  const showDrivers = step <= 6;

  const canProceedStep4 =
    (pickupMethod === 'photo' || pickupCode.length === 4) &&
    (deliveryMethod === 'photo' || deliveryCode.length === 4);

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
          <span className="inline-block bg-radler-ink-800 text-white font-heading font-bold text-xs tracking-[1.5px] px-3 py-1.5 rounded-[10px]">
            RADLER
          </span>
        </div>

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
              Weiter
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
                Zurück
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!dropoff}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter
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
                Zurück
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!vehicleType}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Schritt 4: Übergabe-Optionen */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Abholung */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <h3 className="font-semibold text-gray-900">Abholung</h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPickupMethod('code')}
                  className={`py-3 px-2 rounded-xl text-sm font-semibold transition-colors ${
                    pickupMethod === 'code'
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  🔑 Persönliche Übergabe
                </button>
                <button
                  onClick={() => setPickupMethod('photo')}
                  className={`py-3 px-2 rounded-xl text-sm font-semibold transition-colors ${
                    pickupMethod === 'photo'
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  📸 Paket ablegen
                </button>
              </div>

              {pickupMethod === 'code' ? (
                <PinInput
                  value={pickupCode}
                  onChange={setPickupCode}
                  label="Lege deinen Abhol-Code fest"
                  hint="Gib dem Kurier diesen Code bei der Abholung"
                />
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">Der Kurier fotografiert das abgelegte Paket als Nachweis</p>
                </div>
              )}
            </div>

            {/* Zustellung */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <h3 className="font-semibold text-gray-900">Zustellung</h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDeliveryMethod('code')}
                  className={`py-3 px-2 rounded-xl text-sm font-semibold transition-colors ${
                    deliveryMethod === 'code'
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  🔑 Persönliche Übergabe
                </button>
                <button
                  onClick={() => setDeliveryMethod('photo')}
                  className={`py-3 px-2 rounded-xl text-sm font-semibold transition-colors ${
                    deliveryMethod === 'photo'
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  📸 Paket ablegen
                </button>
              </div>

              {deliveryMethod === 'code' ? (
                <PinInput
                  value={deliveryCode}
                  onChange={setDeliveryCode}
                  label="Lege deinen Übergabe-Code fest"
                  hint="Gib dem Kurier diesen Code bei der Zustellung"
                />
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600">Der Kurier fotografiert das abgelieferte Paket als Nachweis</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">
                Zurück
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!canProceedStep4}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Schritt 5: Zeitpunkt */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900">Wann soll geliefert werden?</h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScheduleMode('now')}
                  className={`py-4 px-3 rounded-2xl text-center transition-colors ${
                    scheduleMode === 'now'
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span className="text-2xl block mb-1">⚡</span>
                  <span className="font-semibold text-sm">Jetzt</span>
                  <p className={`text-xs mt-0.5 ${scheduleMode === 'now' ? 'text-white/75' : 'text-gray-400'}`}>Sofort loslegen</p>
                </button>
                <button
                  onClick={() => setScheduleMode('later')}
                  className={`py-4 px-3 rounded-2xl text-center transition-colors ${
                    scheduleMode === 'later'
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  <span className="text-2xl block mb-1">📅</span>
                  <span className="font-semibold text-sm">Später</span>
                  <p className={`text-xs mt-0.5 ${scheduleMode === 'later' ? 'text-white/75' : 'text-gray-400'}`}>Termin wählen</p>
                </button>
              </div>

              {scheduleMode === 'later' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Datum</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Uhrzeit</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  {scheduledDate && scheduledTime && (
                    <div className="bg-primary/5 rounded-xl px-4 py-3 flex items-center gap-2">
                      <span className="text-lg">📅</span>
                      <p className="text-sm text-primary font-medium">
                        {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' um '}
                        {scheduledTime} Uhr
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">
                Zurück
              </button>
              <button
                onClick={() => setStep(6)}
                disabled={scheduleMode === 'later' && (!scheduledDate || !scheduledTime)}
                className="flex-1 bg-primary text-primary-fg font-semibold py-4 rounded-2xl disabled:opacity-40 active:bg-primary-dark transition-colors"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Schritt 6: Zusammenfassung */}
        {step === 6 && pickup && dropoff && vehicleType && (
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pickupMethod === 'code' ? `Code: ${pickupCode}` : 'Foto-Nachweis'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Ziel</p>
                  <p className="text-sm text-gray-900">{dropoff.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deliveryMethod === 'code' ? `Code: ${deliveryCode}` : 'Foto-Nachweis'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                <span className="text-lg">{vehicleType === 'bicycle' ? '🚲' : '🚛'}</span>
                <p className="text-sm text-gray-600">{vehicleType === 'bicycle' ? 'Fahrradkurier' : 'Lastenrad'}</p>
              </div>
            </div>

            {/* Beschreibung */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="text-xs text-gray-400 font-semibold uppercase">Beschreibung / Hinweise für den Kurier</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.substring(0, 500))}
                placeholder="z.B. Paket steht vor der Tür, bitte klingeln bei Müller, zerbrechlich..."
                rows={3}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
              <p className="text-right text-xs text-gray-300 mt-1">{description.length}/500</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-error text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Scheduling Info in Summary */}
            {scheduleMode === 'later' && scheduledDate && scheduledTime && (
              <div className="bg-white rounded-3xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="text-xs text-gray-400">Geplante Abholung</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' um '}
                      {scheduledTime} Uhr
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(5)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">
                Zurück
              </button>
              <button
                onClick={handleBook}
                disabled={loading}
                className="flex-1 bg-primary text-primary-fg font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-60 active:bg-primary-dark transition-colors"
              >
                {loading ? 'Buchen...' : scheduleMode === 'later' ? `Planen – ${formatPrice(calculatePrice(vehicleType, distanceKm))}` : `Buchen – ${formatPrice(calculatePrice(vehicleType, distanceKm))}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <NavBar />
    </div>
  );
}
