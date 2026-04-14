'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { calculateRikschaPrice, formatPrice, RIKSCHA_PRICING, RikschaVehicle } from '@/lib/maps';
import AddressInput from '@/components/AddressInput';
import Map from '@/components/Map';
import NavBar from '@/components/NavBar';

interface Location {
  address: string;
  lat: number;
  lng: number;
}

type Step = 1 | 2 | 3 | 4;
type RikschaMode = 'taxi' | 'tour';

const TOUR_DURATIONS = [
  { hours: 0.5, label: '30 Min' },
  { hours: 1, label: '1 Std.' },
  { hours: 1.5, label: '1,5 Std.' },
  { hours: 2, label: '2 Std.' },
  { hours: 3, label: '3 Std.' },
];

const VEHICLE_OPTIONS: { type: RikschaVehicle; emoji: string; name: string; desc: string }[] = [
  { type: 'tandem', emoji: '🚲🚲', name: 'Tandem', desc: '1 Fahrgast' },
  { type: 'rikscha', emoji: '🛺', name: 'Rikscha', desc: 'bis 2 Fahrgäste' },
  { type: 'rikscha_xl', emoji: '🛺', name: 'Rikscha XL', desc: 'bis 4 Fahrgäste' },
];

export default function BookRikschaPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<RikschaMode | null>(null);

  // Taxi
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);

  // Tour
  const [tourPickup, setTourPickup] = useState<Location | null>(null);
  const [tourDuration, setTourDuration] = useState(1);
  const [tourDate, setTourDate] = useState('');
  const [tourTime, setTourTime] = useState('');
  const [tourNote, setTourNote] = useState('');

  // Shared
  const [passengerCount, setPassengerCount] = useState(2);
  const [vehicleType, setVehicleType] = useState<RikschaVehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = { address: 'Mein Standort', lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPickup(loc);
      setTourPickup(loc);
    }, () => {});
  }, []);

  const handleRouteCalculated = useCallback((km: number) => {
    setDistanceKm(km);
  }, []);

  // Auto-select vehicle based on passenger count
  useEffect(() => {
    if (!vehicleType) return;
    const max = RIKSCHA_PRICING[vehicleType].maxPassengers;
    if (passengerCount > max) {
      setVehicleType(null);
    }
  }, [passengerCount, vehicleType]);

  const price = vehicleType
    ? calculateRikschaPrice(vehicleType, mode || 'taxi', distanceKm, tourDuration)
    : 0;

  async function handleBook() {
    if (!vehicleType || !mode) return;
    setError('');
    setLoading(true);
    try {
      const isTour = mode === 'tour';
      const pickupLoc = isTour ? tourPickup : pickup;
      const dropoffLoc = isTour ? (tourPickup || pickup) : dropoff;
      if (!pickupLoc) throw new Error('Startort fehlt');
      if (!isTotal && !dropoffLoc) throw new Error('Zielort fehlt');

      let tour_start_time: string | undefined;
      if (isTotal && tourDate && tourTime) {
        tour_start_time = new Date(`${tourDate}T${tourTime}`).toISOString();
      }

      const data = await apiFetch('/api/rides', {
        method: 'POST',
        body: JSON.stringify({
          service_type: isTotal ? 'rikscha_tour' : 'rikscha_taxi',
          pickup_address: pickupLoc.address,
          pickup_lat: pickupLoc.lat,
          pickup_lng: pickupLoc.lng,
          dropoff_address: isTotal ? pickupLoc.address : dropoffLoc!.address,
          dropoff_lat: isTotal ? pickupLoc.lat : dropoffLoc!.lat,
          dropoff_lng: isTotal ? pickupLoc.lng : dropoffLoc!.lng,
          vehicle_type: vehicleType,
          distance_km: isTotal ? 0 : distanceKm,
          passenger_count: passengerCount,
          tour_duration_hours: isTotal ? tourDuration : undefined,
          tour_start_time,
          tour_note: isTotal ? tourNote || undefined : undefined,
          description: description || undefined,
        }),
      });
      if (data.error) throw new Error(data.error);
      router.replace(`/track/${data.ride.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Buchen');
    } finally {
      setLoading(false);
    }
  }

  // Fix: isTotal should be isTour
  const isTotal = mode === 'tour';

  const stepTitles = ['Modus', mode === 'tour' ? 'Tour planen' : 'Route', 'Fahrzeug', 'Zusammenfassung'];

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
          <span className="font-heading text-sm font-semibold text-radler-ink-600">Rikscha</span>
        </div>

        <div className="flex items-center gap-2">
          {stepTitles.map((title, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i + 1 < step ? 'bg-primary text-white' : i + 1 === step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
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
        {/* Schritt 1: Modus wählen */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Was möchtest du?</h3>
              <div className="space-y-3">
                <button
                  onClick={() => { setMode('taxi'); setStep(2); }}
                  className="w-full bg-gray-50 hover:bg-gray-100 active:bg-gray-100 border border-gray-200 rounded-2xl p-5 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🛺</span>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-gray-900">Rikscha-Taxi</p>
                      <p className="text-sm text-gray-500 mt-0.5">Von A nach B – wie ein Fahrrad-Taxi</p>
                      <p className="text-xs text-primary font-semibold mt-1">ab 10,00 EUR</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button
                  onClick={() => { setMode('tour'); setStep(2); }}
                  className="w-full bg-gray-50 hover:bg-gray-100 active:bg-gray-100 border border-gray-200 rounded-2xl p-5 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🗺</span>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-gray-900">Stadt-Tour</p>
                      <p className="text-sm text-gray-500 mt-0.5">Sightseeing in Konstanz</p>
                      <p className="text-xs text-primary font-semibold mt-1">ab 30,00 EUR / Std.</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schritt 2a: Taxi – Route */}
        {step === 2 && mode === 'taxi' && (
          <div className="space-y-4">
            {(pickup || dropoff) && (
              <Map
                markers={[
                  ...(pickup ? [{ lat: pickup.lat, lng: pickup.lng, color: '#22C55E', label: 'A' }] : []),
                  ...(dropoff ? [{ lat: dropoff.lat, lng: dropoff.lng, color: '#EF4444', label: 'B' }] : []),
                ]}
                showRoute={!!pickup && !!dropoff}
                onRouteCalculated={handleRouteCalculated}
                className="h-44"
              />
            )}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Startort</label>
              <AddressInput placeholder="Wo wirst du abgeholt?" value={pickup?.address || ''} onSelect={setPickup} />
              <button
                onClick={() => {
                  navigator.geolocation?.getCurrentPosition((pos) => {
                    setPickup({ address: 'Mein Standort', lat: pos.coords.latitude, lng: pos.coords.longitude });
                  });
                }}
                className="mt-2 flex items-center gap-2 text-primary text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mein Standort
              </button>
            </div>
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zielort</label>
              <AddressInput placeholder="Wohin soll es gehen?" value={dropoff?.address || ''} onSelect={setDropoff} />
            </div>

            {/* Passagiere */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Anzahl Fahrgäste</label>
              <div className="flex items-center justify-center gap-5">
                <button
                  onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 active:bg-gray-200"
                >-</button>
                <span className="text-3xl font-black text-gray-900 w-10 text-center">{passengerCount}</span>
                <button
                  onClick={() => setPassengerCount(Math.min(4, passengerCount + 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 active:bg-gray-200"
                >+</button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setMode(null); }} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">Zurück</button>
              <button onClick={() => setStep(3)} disabled={!pickup || !dropoff} className="flex-1 bg-primary text-white font-semibold py-4 rounded-2xl disabled:opacity-40">Weiter</button>
            </div>
          </div>
        )}

        {/* Schritt 2b: Tour – Planen */}
        {step === 2 && mode === 'tour' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Treffpunkt</label>
              <AddressInput placeholder="Wo treffen wir uns?" value={tourPickup?.address || ''} onSelect={setTourPickup} />
              <button
                onClick={() => {
                  navigator.geolocation?.getCurrentPosition((pos) => {
                    setTourPickup({ address: 'Mein Standort', lat: pos.coords.latitude, lng: pos.coords.longitude });
                  });
                }}
                className="mt-2 flex items-center gap-2 text-primary text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Mein Standort
              </button>
            </div>

            {/* Dauer */}
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Tour-Dauer</label>
              <div className="flex flex-wrap gap-2">
                {TOUR_DURATIONS.map((d) => (
                  <button
                    key={d.hours}
                    onClick={() => setTourDuration(d.hours)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      tourDuration === d.hours
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Datum + Uhrzeit */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Wann?</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={tourDate}
                  onChange={(e) => setTourDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  type="time"
                  value={tourTime}
                  onChange={(e) => setTourTime(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {tourDate && tourTime && (
                <div className="bg-primary/5 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span>📅</span>
                  <p className="text-sm text-primary font-medium">
                    {new Date(`${tourDate}T${tourTime}`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} um {tourTime} Uhr
                  </p>
                </div>
              )}
            </div>

            {/* Passagiere */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Anzahl Fahrgäste</label>
              <div className="flex items-center justify-center gap-5">
                <button onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 active:bg-gray-200">-</button>
                <span className="text-3xl font-black text-gray-900 w-10 text-center">{passengerCount}</span>
                <button onClick={() => setPassengerCount(Math.min(4, passengerCount + 1))} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600 active:bg-gray-200">+</button>
              </div>
            </div>

            {/* Notiz */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notiz für den Fahrer (optional)</label>
              <textarea
                value={tourNote}
                onChange={(e) => setTourNote(e.target.value.substring(0, 300))}
                placeholder="z.B. Wir möchten die Altstadt sehen..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setMode(null); }} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">Zurück</button>
              <button
                onClick={() => setStep(3)}
                disabled={!tourPickup || !tourDate || !tourTime}
                className="flex-1 bg-primary text-white font-semibold py-4 rounded-2xl disabled:opacity-40"
              >Weiter</button>
            </div>
          </div>
        )}

        {/* Schritt 3: Fahrzeug wählen */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Fahrzeug wählen</h3>
              <div className="space-y-3">
                {VEHICLE_OPTIONS.map((v) => {
                  const p = RIKSCHA_PRICING[v.type];
                  const tooMany = passengerCount > p.maxPassengers;
                  const isSelected = vehicleType === v.type;
                  const pricePreview = mode === 'tour'
                    ? formatPrice(tourDuration * p.tourPerHour)
                    : `ab ${formatPrice(mode === 'taxi' && distanceKm > 0 ? calculateRikschaPrice(v.type, 'taxi', distanceKm, 0) : p.taxiMin)}`;

                  return (
                    <button
                      key={v.type}
                      onClick={() => !tooMany && setVehicleType(v.type)}
                      disabled={tooMany}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                        tooMany
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white active:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{v.emoji}</span>
                        <div className="flex-1">
                          <p className="font-heading font-bold text-gray-900">{v.name}</p>
                          <p className="text-xs text-gray-500">{v.desc}</p>
                          {tooMany && (
                            <p className="text-xs text-red-500 mt-1">Zu viele Fahrgäste ({passengerCount}) für {v.name}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-gray-700'}`}>{pricePreview}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">Zurück</button>
              <button onClick={() => setStep(4)} disabled={!vehicleType} className="flex-1 bg-primary text-white font-semibold py-4 rounded-2xl disabled:opacity-40">Weiter</button>
            </div>
          </div>
        )}

        {/* Schritt 4: Zusammenfassung */}
        {step === 4 && vehicleType && (
          <div className="space-y-4">
            {/* Karte */}
            {mode === 'taxi' && pickup && dropoff && (
              <Map
                markers={[
                  { lat: pickup.lat, lng: pickup.lng, color: '#22C55E', label: 'A' },
                  { lat: dropoff.lat, lng: dropoff.lng, color: '#EF4444', label: 'B' },
                ]}
                showRoute
                onRouteCalculated={handleRouteCalculated}
                className="h-44"
              />
            )}
            {mode === 'tour' && tourPickup && (
              <Map
                markers={[{ lat: tourPickup.lat, lng: tourPickup.lng, color: '#22C55E', label: 'T' }]}
                className="h-32"
              />
            )}

            {/* Info Card */}
            <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{mode === 'tour' ? '🗺' : '🛺'}</span>
                <h3 className="font-heading font-bold text-gray-900">{mode === 'tour' ? 'Stadt-Tour' : 'Rikscha-Taxi'}</h3>
              </div>

              {mode === 'taxi' && pickup && dropoff && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Start</p>
                      <p className="text-sm text-gray-900">{pickup.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Ziel</p>
                      <p className="text-sm text-gray-900">{dropoff.address}</p>
                    </div>
                  </div>
                </>
              )}

              {mode === 'tour' && tourPickup && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">Treffpunkt</p>
                      <p className="text-sm text-gray-900">{tourPickup.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm mt-0.5">🕐</span>
                    <div>
                      <p className="text-xs text-gray-400">Tour-Dauer</p>
                      <p className="text-sm text-gray-900">{tourDuration >= 1 ? `${tourDuration} Std.` : '30 Min'}</p>
                    </div>
                  </div>
                  {tourDate && tourTime && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm mt-0.5">📅</span>
                      <div>
                        <p className="text-xs text-gray-400">Termin</p>
                        <p className="text-sm text-gray-900">
                          {new Date(`${tourDate}T${tourTime}`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })} um {tourTime} Uhr
                        </p>
                      </div>
                    </div>
                  )}
                  {tourNote && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm mt-0.5">📝</span>
                      <div>
                        <p className="text-xs text-gray-400">Notiz</p>
                        <p className="text-sm text-gray-700 italic">{tourNote}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fahrzeug</span>
                  <span className="text-gray-900 font-medium">{VEHICLE_OPTIONS.find(v => v.type === vehicleType)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Fahrgäste</span>
                  <span className="text-gray-900 font-medium">{passengerCount}</span>
                </div>
                {mode === 'taxi' && distanceKm > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Distanz</span>
                    <span className="text-gray-900 font-medium">{distanceKm.toFixed(1)} km</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="font-heading font-bold text-gray-900">Gesamt</span>
                <span className="font-heading text-2xl font-bold text-primary">{formatPrice(price)}</span>
              </div>
              <p className="text-xs text-gray-400 text-center">Bezahlung: Bar an den Fahrer</p>
            </div>

            {/* Beschreibung */}
            <div className="bg-white rounded-3xl p-4 shadow-sm">
              <label className="text-xs text-gray-400 font-semibold uppercase">Hinweise für den Fahrer</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.substring(0, 500))}
                placeholder="z.B. Wir stehen vor dem Münster, rotes Kleid..."
                rows={2}
                className="w-full mt-2 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
              <p className="text-right text-xs text-gray-300 mt-1">{description.length}/500</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-gray-100 text-gray-700 font-semibold py-4 rounded-2xl">Zurück</button>
              <button
                onClick={handleBook}
                disabled={loading}
                className="flex-1 bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/30 disabled:opacity-60"
              >
                {loading ? 'Buchen...' : `Buchen – ${formatPrice(price)}`}
              </button>
            </div>
          </div>
        )}
      </div>

      <NavBar />
    </div>
  );
}
