'use client';

import { useEffect, useState, useRef } from 'react';
import Map from './Map';
import { formatPrice } from '@/lib/maps';

interface Ride {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  price: number;
  vehicle_type: string;
}

interface Props {
  ride: Ride;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
}

const TIMEOUT_SECONDS = 60;

export default function RideRequest({ ride, onAccept, onDecline, accepting }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(intervalRef.current!); onDecline(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [onDecline]);

  const progress = (secondsLeft / TIMEOUT_SECONDS) * 100;
  const timerColor = secondsLeft > 20 ? 'bg-online' : secondsLeft > 10 ? 'bg-warning' : 'bg-error';

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Halbtransparenter Hintergrund */}
      <div className="absolute inset-0 bg-black/40" onClick={onDecline} />

      {/* Slide-Up Panel */}
      <div className="relative w-full bg-white rounded-t-3xl animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Griff */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-warning uppercase tracking-wider">⚡ Neuer Auftrag</p>
            <p className="text-xl font-black text-gray-900">{formatPrice(Number(ride.price))}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black ${secondsLeft <= 10 ? 'text-error' : 'text-gray-700'}`}>
              {secondsLeft}s
            </p>
            <p className="text-xs text-gray-400">verbleibend</p>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="h-1.5 bg-gray-100 mx-5 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full ${timerColor} rounded-full transition-all duration-1000`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mini Karte */}
        <div className="px-5 mb-4">
          <Map
            markers={[
              { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), color: '#22C55E', label: 'A' },
              { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng), color: '#EF4444', label: 'B' },
            ]}
            showRoute
            className="h-44"
          />
        </div>

        {/* Auftragsdetails */}
        <div className="px-5 space-y-3 mb-5">
          <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
            <div className="w-7 h-7 bg-online/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-online" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Abholung</p>
              <p className="text-sm font-semibold text-gray-900">{ride.pickup_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
            <div className="w-7 h-7 bg-error/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-error" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Ziel</p>
              <p className="text-sm font-semibold text-gray-900">{ride.dropoff_address}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Distanz', value: ride.distance_km ? `${Number(ride.distance_km).toFixed(1)} km` : '–' },
              { label: 'Verdienst', value: formatPrice(Number(ride.price)) },
              { label: 'Fahrzeug', value: ride.vehicle_type === 'bicycle' ? '🚲 Rad' : '🚛 Lastenrad' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 pb-8 flex flex-col gap-3">
          <button
            onClick={onAccept}
            disabled={accepting}
            className="w-full bg-primary text-white font-black text-lg py-5 rounded-2xl shadow-lg shadow-primary/30 active:bg-primary/80 disabled:opacity-60 transition-all"
          >
            {accepting ? 'Annehmen...' : '✓ ANNEHMEN'}
          </button>
          <button
            onClick={onDecline}
            className="w-full bg-gray-100 text-gray-500 font-semibold py-4 rounded-2xl active:bg-gray-200"
          >
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
