'use client';

import { useState, useRef, useEffect } from 'react';
import Map from './Map';
import { apiFetch } from '@/lib/api';
import { formatPrice } from '@/lib/maps';

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
  customer_name?: string;
  pickup_method?: string;
  pickup_code_confirmed?: boolean;
  pickup_photo_url?: string;
  delivery_method?: string;
  delivery_code_confirmed?: boolean;
  delivery_photo_url?: string;
  service_type?: string;
  passenger_count?: number;
  tour_duration_hours?: number;
  driver_payout?: number;
}

interface Props {
  ride: Ride;
  driverLocation: { lat: number; lng: number } | null;
  onStatusUpdate: (newStatus: string) => void;
  userName?: string;
}

const COURIER_ACTION = {
  accepted: { label: 'ABGEHOLT', nextStatus: 'picked_up', color: 'bg-warning' },
  picked_up: { label: 'ZUGESTELLT', nextStatus: 'delivered', color: 'bg-primary' },
};

const RIKSCHA_ACTION = {
  accepted: { label: 'FAHRT GESTARTET', nextStatus: 'picked_up', color: 'bg-warning' },
  picked_up: { label: 'FAHRT BEENDET', nextStatus: 'delivered', color: 'bg-primary' },
};

function CodeInput({ onVerify, verifying, error }: {
  onVerify: (code: string) => void;
  verifying: boolean;
  error: string | null;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 3) refs[index + 1].current?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  }

  const code = digits.join('');
  const isComplete = code.length === 4;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 justify-center">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-14 h-16 text-center text-2xl font-black rounded-xl outline-none border-2 transition-colors ${
              error ? 'border-red-400 bg-red-50 animate-shake' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/30'
            }`}
          />
        ))}
      </div>
      {error && <p className="text-center text-sm text-red-500 font-semibold">{error}</p>}
      <button
        onClick={() => onVerify(code)}
        disabled={!isComplete || verifying}
        className="w-full bg-primary text-white font-semibold py-3 rounded-2xl disabled:opacity-40 active:bg-primary/80"
      >
        {verifying ? 'Prüfe...' : 'Code bestätigen'}
      </button>
    </div>
  );
}

export default function ActiveRide({ ride, driverLocation, onStatusUpdate, userName }: Props) {
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Rikscha detection
  const isRikscha = ['rikscha_taxi', 'rikscha_tour'].includes(ride.service_type || '');
  const isTour = ride.service_type === 'rikscha_tour';

  // Tour timer state
  const [tourSecondsLeft, setTourSecondsLeft] = useState<number | null>(null);
  const [tourStartedAt, setTourStartedAt] = useState<number | null>(null);

  // Start tour timer when ride is picked_up and it's a tour
  useEffect(() => {
    if (!isTour || ride.status !== 'picked_up' || !ride.tour_duration_hours) return;

    // Set start time if not set
    if (!tourStartedAt) {
      setTourStartedAt(Date.now());
      setTourSecondsLeft(ride.tour_duration_hours * 3600);
    }

    const interval = setInterval(() => {
      setTourSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTour, ride.status, ride.tour_duration_hours, tourStartedAt]);

  // Pickup verification state
  const [pickupVerified, setPickupVerified] = useState(ride.pickup_code_confirmed || false);
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(ride.pickup_photo_url || null);
  const [pickupPhotoPreview, setPickupPhotoPreview] = useState<string | null>(null);
  const [pickupPhotoUploading, setPickupPhotoUploading] = useState(false);
  const [pickupCodeError, setPickupCodeError] = useState<string | null>(null);
  const [pickupVerifying, setPickupVerifying] = useState(false);
  const pickupFileRef = useRef<HTMLInputElement>(null);

  // Delivery verification state
  const [deliveryVerified, setDeliveryVerified] = useState(ride.delivery_code_confirmed || false);
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState<string | null>(ride.delivery_photo_url || null);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null);
  const [deliveryPhotoUploading, setDeliveryPhotoUploading] = useState(false);
  const [deliveryCodeError, setDeliveryCodeError] = useState<string | null>(null);
  const [deliveryVerifying, setDeliveryVerifying] = useState(false);
  const deliveryFileRef = useRef<HTMLInputElement>(null);

  const actionMap = isRikscha ? RIKSCHA_ACTION : COURIER_ACTION;
  const action = actionMap[ride.status as keyof typeof actionMap];
  const pickupMethod = ride.pickup_method || 'photo';
  const deliveryMethod = ride.delivery_method || 'photo';

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${
    ride.status === 'accepted' ? `${ride.pickup_lat},${ride.pickup_lng}` : `${ride.dropoff_lat},${ride.dropoff_lng}`
  }&travelmode=bicycling`;

  // Can proceed to next status? Rikscha skips all verification
  const pickupReady = isRikscha ? true : (pickupMethod === 'code' ? pickupVerified : !!pickupPhotoUrl);
  const deliveryReady = isRikscha ? true : (deliveryMethod === 'code' ? deliveryVerified : !!deliveryPhotoUrl);
  const canProceed = ride.status === 'accepted' ? pickupReady : deliveryReady;

  // Tour timer helper
  function formatTimer(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function handleVerifyPickup(code: string) {
    setPickupVerifying(true);
    setPickupCodeError(null);
    try {
      const data = await apiFetch(`/api/rides/${ride.id}/verify-pickup`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (data.error) throw new Error(data.error);
      setPickupVerified(true);
    } catch (err) {
      setPickupCodeError(err instanceof Error ? err.message : 'Falscher Code');
    } finally {
      setPickupVerifying(false);
    }
  }

  async function handleVerifyDelivery(code: string) {
    setDeliveryVerifying(true);
    setDeliveryCodeError(null);
    try {
      const data = await apiFetch(`/api/rides/${ride.id}/verify-delivery`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (data.error) throw new Error(data.error);
      setDeliveryVerified(true);
    } catch (err) {
      setDeliveryCodeError(err instanceof Error ? err.message : 'Falscher Code');
    } finally {
      setDeliveryVerifying(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'pickup' | 'delivery') {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (type === 'pickup') setPickupPhotoPreview(ev.target?.result as string);
      else setDeliveryPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    const setUploading = type === 'pickup' ? setPickupPhotoUploading : setDeliveryPhotoUploading;
    const setUrl = type === 'pickup' ? setPickupPhotoUrl : setDeliveryPhotoUrl;
    const endpoint = type === 'pickup' ? 'pickup-photo' : 'photo';

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/rides/${ride.id}/${endpoint}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
      setUrl(type === 'pickup' ? data.pickup_photo_url : data.delivery_photo_url);
    } catch (err) {
      console.error('Foto-Upload fehlgeschlagen:', err);
      if (type === 'pickup') setPickupPhotoPreview(null);
      else setDeliveryPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleAction() {
    if (!action || !canProceed) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/rides/${ride.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action.nextStatus }),
      });
      if (data.error) throw new Error(data.error);
      onStatusUpdate(action.nextStatus);
    } catch (err) {
      console.error('Status-Update fehlgeschlagen:', err);
      alert('Fehler: ' + (err instanceof Error ? err.message : 'Status-Update fehlgeschlagen'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Auftrag wirklich stornieren?')) return;
    setCancelling(true);
    try {
      const data = await apiFetch(`/api/rides/${ride.id}/cancel`, { method: 'PATCH' });
      if (data.error) throw new Error(data.error);
      onStatusUpdate('cancelled');
    } catch (err) {
      console.error('Stornierung fehlgeschlagen:', err);
      alert('Fehler: ' + (err instanceof Error ? err.message : 'Stornierung fehlgeschlagen'));
    } finally {
      setCancelling(false);
    }
  }

  const markers = [
    { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), color: '#22C55E', label: 'A' },
    { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng), color: '#EF4444', label: 'B' },
  ];

  // Determine which verification UI to show
  const isPickupPhase = ride.status === 'accepted';
  const currentMethod = isPickupPhase ? pickupMethod : deliveryMethod;
  const currentPhotoPreview = isPickupPhase ? pickupPhotoPreview : deliveryPhotoPreview;
  const currentPhotoUrl = isPickupPhase ? pickupPhotoUrl : deliveryPhotoUrl;
  const currentPhotoUploading = isPickupPhase ? pickupPhotoUploading : deliveryPhotoUploading;
  const currentFileRef = isPickupPhase ? pickupFileRef : deliveryFileRef;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Fahrer-App</p>
            <h1 className="text-xl font-black text-white">{userName || 'Fahrer'}</h1>
          </div>
        </div>
      </div>

      {/* Karte */}
      <div className="px-4 pt-4" onClick={() => setMapExpanded(!mapExpanded)}>
        <Map
          markers={markers}
          driverLocation={driverLocation}
          showRoute
          showCenterButton
          style={{ width: '100%', height: mapExpanded ? '65vh' : '35vh', transition: 'height 0.3s ease' }}
          className="rounded-2xl"
        />
      </div>

      {/* Info & Buttons */}
      <div className="bg-white">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pt-2 pb-8">
          {/* Status Badge + Preis */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {isRikscha ? (isTour ? '🗺 Stadt-Tour' : '🛺 Rikscha-Taxi') : 'Aktiver Auftrag'}
              </p>
              <p className="text-2xl font-black text-gray-900">{formatPrice(Number(ride.driver_payout || ride.price))}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-xs font-bold text-white shadow-sm ${
              ride.status === 'accepted' ? 'bg-warning' : 'bg-primary'
            }`}>
              {ride.status === 'accepted'
                ? (isRikscha ? 'Zum Treffpunkt' : 'Zur Abholung')
                : (isRikscha ? 'Fahrt läuft' : 'Unterwegs')}
            </span>
          </div>

          {/* Adressen */}
          <div className="mb-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0 shadow-sm" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                  {isRikscha ? 'Treffpunkt' : 'Abholung'}
                </p>
                <p className="text-sm font-semibold text-gray-900">{ride.pickup_address}</p>
              </div>
            </div>
            <div className="ml-1.5 border-l-2 border-dashed border-gray-200 h-3" />
            <div className="flex items-start gap-3 mt-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0 shadow-sm" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">
                  {isTour ? 'Endpunkt' : 'Ziel'}
                </p>
                <p className="text-sm font-semibold text-gray-900">{ride.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Tour Timer */}
          {isTour && ride.status === 'picked_up' && tourSecondsLeft !== null && (
            <div className={`mb-5 rounded-2xl p-4 text-center ${tourSecondsLeft <= 600 ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tour-Restzeit</p>
              <p className={`text-3xl font-black ${tourSecondsLeft <= 600 ? 'text-red-600' : tourSecondsLeft <= 1800 ? 'text-orange-500' : 'text-blue-700'}`}>
                {formatTimer(tourSecondsLeft)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{ride.tour_duration_hours} Std. gebucht</p>
            </div>
          )}

          {/* Infos */}
          <div className="flex gap-3 mb-5">
            {ride.customer_name && (
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Kunde</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{ride.customer_name}</p>
              </div>
            )}
            {isRikscha && (
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Fahrgäste</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{ride.passenger_count || 1} Pers.</p>
              </div>
            )}
            <div className="flex-1 bg-gray-50 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Fahrzeug</p>
              <p className="text-sm font-bold mt-0.5">
                {ride.vehicle_type === 'bicycle' ? '🚲 Rad'
                  : ride.vehicle_type === 'cargo_bike' ? '🚛 Lastenrad'
                  : ride.vehicle_type === 'rikscha' ? '🛺 Rikscha'
                  : ride.vehicle_type === 'rikscha_xl' ? '🛺 XL'
                  : ride.vehicle_type === 'tandem' ? '🚲🚲 Tandem'
                  : '🚲 Rad'}
              </p>
            </div>
          </div>

          {/* Verifizierung — nur für Kurier, nicht für Rikscha */}
          {!isRikscha && <div className="mb-4">
            {currentMethod === 'code' && !canProceed && (
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700 text-center">
                  {isPickupPhase ? '🔑 Abhol-Code eingeben' : '🔑 Übergabe-Code eingeben'}
                </p>
                <CodeInput
                  onVerify={isPickupPhase ? handleVerifyPickup : handleVerifyDelivery}
                  verifying={isPickupPhase ? pickupVerifying : deliveryVerifying}
                  error={isPickupPhase ? pickupCodeError : deliveryCodeError}
                />
              </div>
            )}

            {currentMethod === 'code' && canProceed && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">✓</span>
                </div>
                <p className="text-sm font-semibold text-green-700">
                  {isPickupPhase ? 'Abhol-Code bestätigt' : 'Übergabe-Code bestätigt'}
                </p>
              </div>
            )}

            {currentMethod === 'photo' && !currentPhotoUrl && (
              <div>
                <p className="text-xs text-gray-500 mb-2 text-center">
                  {isPickupPhase ? 'Fotografiere das Paket bei der Abholung' : 'Fotografiere das abgelieferte Paket als Nachweis'}
                </p>
                {!currentPhotoPreview ? (
                  <button
                    onClick={() => currentFileRef.current?.click()}
                    disabled={currentPhotoUploading}
                    className="w-full bg-gray-50 border-2 border-dashed border-gray-300 text-gray-600 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-gray-100 disabled:opacity-50"
                  >
                    <span className="text-xl">📸</span>
                    {currentPhotoUploading ? 'Wird hochgeladen...' : 'FOTO MACHEN'}
                  </button>
                ) : (
                  <div className="relative">
                    <img src={currentPhotoPreview} alt="Foto" className="w-full h-40 object-cover rounded-2xl" />
                    {currentPhotoUploading && (
                      <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                        <p className="text-white text-sm font-semibold">Wird hochgeladen...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentMethod === 'photo' && currentPhotoUrl && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">✓</span>
                </div>
                <p className="text-sm font-semibold text-green-700">Foto hochgeladen</p>
              </div>
            )}

            <input ref={pickupFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'pickup')} />
            <input ref={deliveryFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'delivery')} />
          </div>}

          {/* Navigation Button */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-4 rounded-2xl mb-4 active:bg-gray-100 transition-colors"
          >
            <span>🗺</span>
            In Google Maps navigieren
          </a>

          {/* Haupt-Action Button */}
          {action && (
            <button
              onClick={handleAction}
              disabled={loading || !canProceed}
              className={`w-full ${action.color} text-white font-black text-lg py-5 rounded-2xl shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all`}
            >
              {loading ? 'Bitte warten...' : `✓ ${action.label}`}
            </button>
          )}
          {!canProceed && !isRikscha && (
            <p className="text-center text-xs text-gray-400 mt-2">
              {currentMethod === 'code' ? 'Bitte zuerst den Code eingeben' : 'Bitte zuerst ein Foto machen'}
            </p>
          )}

          {/* Stornieren — nur vor Abholung */}
          {ride.status === 'accepted' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full mt-3 bg-white border border-red-200 text-red-500 font-semibold py-3.5 rounded-2xl active:bg-red-50 disabled:opacity-40 transition-colors"
            >
              {cancelling ? 'Wird storniert...' : (isRikscha ? 'Fahrt stornieren' : 'Auftrag stornieren')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
