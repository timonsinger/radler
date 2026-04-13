'use client';

import { useState, useRef } from 'react';
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
}

interface Props {
  ride: Ride;
  driverLocation: { lat: number; lng: number } | null;
  onStatusUpdate: (newStatus: string) => void;
}

const ACTION = {
  accepted: { label: 'ABGEHOLT', nextStatus: 'picked_up', color: 'bg-warning' },
  picked_up: { label: 'ZUGESTELLT', nextStatus: 'delivered', color: 'bg-primary' },
};

export default function ActiveRide({ ride, driverLocation, onStatusUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const action = ACTION[ride.status as keyof typeof ACTION];

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${
    ride.status === 'accepted' ? `${ride.pickup_lat},${ride.pickup_lng}` : `${ride.dropoff_lat},${ride.dropoff_lng}`
  }&travelmode=bicycling`;

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vorschau anzeigen
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Hochladen
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/rides/${ride.id}/photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
      setPhotoUrl(data.delivery_photo_url);
    } catch (err) {
      console.error('Foto-Upload fehlgeschlagen:', err);
      setPhotoPreview(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleAction() {
    if (!action) return;
    // Für Zustellung: Foto erforderlich
    if (action.nextStatus === 'delivered' && !photoUrl) return;
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

  const markers = [
    { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), color: '#22C55E', label: 'A' },
    { lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng), color: '#EF4444', label: 'B' },
  ];

  const needsPhoto = ride.status === 'picked_up';
  const canDeliver = !needsPhoto || !!photoUrl;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Karte nimmt obere Hälfte ein */}
      <div className="flex-shrink-0" style={{ height: '50vh' }}>
        <Map
          markers={markers}
          driverLocation={driverLocation}
          showRoute
          style={{ width: '100%', height: '100%' }}
          className="rounded-none"
        />
      </div>

      {/* Info & Buttons */}
      <div className="flex-1 overflow-y-auto bg-white rounded-t-3xl -mt-4 shadow-lg">
        {/* Griff */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pt-3 pb-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aktiver Auftrag</p>
              <p className="text-xl font-black text-gray-900">{formatPrice(Number(ride.price))}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${
              ride.status === 'accepted' ? 'bg-warning' : 'bg-primary'
            }`}>
              {ride.status === 'accepted' ? 'Zur Abholung' : 'Abgeholt'}
            </span>
          </div>

          {/* Adressen */}
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-online mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Abholung</p>
                <p className="text-sm font-semibold text-gray-900">{ride.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-error mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Ziel</p>
                <p className="text-sm font-semibold text-gray-900">{ride.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* Infos */}
          <div className="flex gap-3 mb-4">
            {ride.customer_name && (
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Kunde</p>
                <p className="text-sm font-bold text-gray-900">{ride.customer_name}</p>
              </div>
            )}
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Fahrzeug</p>
              <p className="text-sm font-bold">{ride.vehicle_type === 'bicycle' ? '🚲 Rad' : '🚛 Lastenrad'}</p>
            </div>
          </div>

          {/* Foto-Bereich (nur bei picked_up) */}
          {needsPhoto && (
            <div className="mb-4">
              {!photoPreview ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2 text-center">
                    Fotografiere das abgelieferte Paket als Nachweis
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="w-full bg-gray-50 border-2 border-dashed border-gray-300 text-gray-600 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-gray-100 disabled:opacity-50"
                  >
                    <span className="text-xl">📸</span>
                    {photoUploading ? 'Wird hochgeladen...' : 'FOTO MACHEN'}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Ablieferungsfoto"
                    className="w-full h-40 object-cover rounded-2xl"
                  />
                  {photoUploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                      <p className="text-white text-sm font-semibold">Wird hochgeladen...</p>
                    </div>
                  )}
                  {photoUrl && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full w-7 h-7 flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                  {!photoUploading && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 w-full text-xs text-gray-500 text-center"
                    >
                      Foto erneut aufnehmen
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
            </div>
          )}

          {/* Navigation Button */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-2xl mb-3 active:bg-gray-100"
          >
            <span>🗺</span>
            In Google Maps navigieren
          </a>

          {/* Haupt-Action Button */}
          {action && (
            <button
              onClick={handleAction}
              disabled={loading || !canDeliver}
              className={`w-full ${action.color} text-white font-black text-lg py-5 rounded-2xl shadow-lg disabled:opacity-40 active:opacity-80 transition-all`}
            >
              {loading ? 'Bitte warten...' : `✓ ${action.label}`}
            </button>
          )}
          {needsPhoto && !photoUrl && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Bitte zuerst ein Foto machen
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
