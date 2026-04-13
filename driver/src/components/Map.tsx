'use client';

import { useEffect, useRef, useCallback } from 'react';
import { KONSTANZ_CENTER } from '@/lib/maps';

interface Marker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

interface Props {
  markers?: Marker[];
  driverLocation?: { lat: number; lng: number } | null;
  showRoute?: boolean;
  radiusKm?: number;
  className?: string;
}

export default function Map({ markers = [], driverLocation, showRoute, radiusKm, className = '' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const radiusCircleRef = useRef<google.maps.Circle | null>(null);
  const hasCenteredRef = useRef(false);
  const prevMarkersKeyRef = useRef('');
  const markerDataRef = useRef<Marker[]>(markers);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null | undefined>(driverLocation);

  // Keep refs current on every render (synchronous, no re-render)
  markerDataRef.current = markers;
  driverLocationRef.current = driverLocation;

  // Center map on driver — called by "center" button and once on first fix
  const centerOnDriver = useCallback(() => {
    const map = googleMapRef.current;
    const loc = driverLocationRef.current;
    if (!map || !loc) return;

    const data = markerDataRef.current;
    if (data.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      data.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      bounds.extend(loc);
      map.fitBounds(bounds, { top: 60, bottom: 80, left: 40, right: 40 });
    } else {
      map.setCenter(loc);
      map.setZoom(15);
    }
  }, []);

  // Initialize map ONCE
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || !window.google?.maps || googleMapRef.current) return;
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: KONSTANZ_CENTER,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      });
    };
    if (window.google?.maps) { init(); return; }
    const iv = setInterval(() => { if (window.google?.maps) { clearInterval(iv); init(); } }, 200);
    return () => clearInterval(iv);
  }, []);

  // Pickup/Dropoff markers — only when markers actually change by VALUE
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    // Skip if markers haven't changed by value (prevents re-centering on every render)
    const key = JSON.stringify(markers);
    if (key === prevMarkersKeyRef.current) return;
    prevMarkersKeyRef.current = key;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markers.forEach((marker) => {
      const m = new window.google.maps.Marker({
        position: { lat: marker.lat, lng: marker.lng },
        map: googleMapRef.current!,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: marker.color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        label: marker.label
          ? { text: marker.label, color: '#fff', fontSize: '11px', fontWeight: 'bold' }
          : undefined,
      });
      markersRef.current.push(m);
    });
    // New markers = new ride → allow one auto-center on next GPS fix
    hasCenteredRef.current = false;
    // If GPS already known, center now
    if (markers.length > 0 && driverLocationRef.current) {
      centerOnDriver();
      hasCenteredRef.current = true;
    }
  }, [markers, centerOnDriver]);

  // Route — only when markers change
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps || !showRoute || markers.length < 2) return;
    if (!dirRendererRef.current) {
      dirRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#14532D', strokeWeight: 5 },
      });
      dirRendererRef.current.setMap(googleMapRef.current);
    }
    new window.google.maps.DirectionsService().route(
      {
        origin: { lat: markers[0].lat, lng: markers[0].lng },
        destination: { lat: markers[markers.length - 1].lat, lng: markers[markers.length - 1].lng },
        travelMode: window.google.maps.TravelMode.BICYCLING,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, status: any) => {
        if (status === 'OK' && result) dirRendererRef.current!.setDirections(result);
      }
    );
  }, [markers, showRoute]);

  // Driver marker — runs on every GPS update but ONLY moves the marker
  // NEVER touches map view (no panTo, no setCenter, no fitBounds)
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    if (!driverLocation) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
      hasCenteredRef.current = false;
      return;
    }

    const isFirstFix = !driverMarkerRef.current;

    if (isFirstFix) {
      driverMarkerRef.current = new window.google.maps.Marker({
        position: driverLocation,
        map: googleMapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#14532D',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Du',
        zIndex: 10,
      });
    } else {
      // Just move the marker — map stays completely still
      driverMarkerRef.current!.setPosition(driverLocation);
    }

    // Radius circle
    if (radiusKm && radiusKm > 0) {
      if (!radiusCircleRef.current) {
        radiusCircleRef.current = new window.google.maps.Circle({
          map: googleMapRef.current,
          center: driverLocation,
          radius: radiusKm * 1000,
          fillColor: '#22C55E',
          fillOpacity: 0.08,
          strokeColor: '#22C55E',
          strokeWeight: 1.5,
          strokeOpacity: 0.5,
        });
      } else {
        radiusCircleRef.current.setCenter(driverLocation);
        radiusCircleRef.current.setRadius(radiusKm * 1000);
      }
    } else {
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
    }

    // Auto-center ONLY on very first GPS fix, then never again
    if (isFirstFix && !hasCenteredRef.current) {
      centerOnDriver();
      hasCenteredRef.current = true;
    }
  }, [driverLocation, radiusKm, centerOnDriver]);

  return (
    <div ref={mapRef} className={`relative w-full rounded-2xl overflow-hidden ${className}`}>
      {/* Center-on-me button — rendered inside mapRef, Google Maps won't remove it */}
      {driverLocation && (
        <button
          onClick={centerOnDriver}
          className="absolute bottom-3 right-3 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center active:bg-gray-100"
          style={{ zIndex: 1000 }}
          title="Auf meine Position zentrieren"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14532D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}
