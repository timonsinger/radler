'use client';

import { useEffect, useRef } from 'react';
import { KONSTANZ_CENTER } from '@/lib/maps';

interface Marker {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

interface AvailableDriver {
  id: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  rating?: number;
}

interface LocationPing {
  lat: number;
  lng: number;
  timestamp: number;
}

interface Props {
  markers?: Marker[];
  driverLocation?: { lat: number; lng: number } | null;
  className?: string;
  onRouteCalculated?: (distanceKm: number) => void;
  showRoute?: boolean;
  availableDrivers?: AvailableDriver[];
  locationPings?: LocationPing[];
}

export default function Map({
  markers = [],
  driverLocation,
  className = '',
  onRouteCalculated,
  showRoute,
  availableDrivers = [],
  locationPings = [],
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const hasCenteredRef = useRef(false);
  const prevMarkersKeyRef = useRef('');

  // --- Driver markers: keyed by driver id ---
  const driverMarkerMapRef = useRef<globalThis.Map<string, google.maps.Marker>>(new globalThis.Map());

  // --- Ping markers: managed incrementally ---
  const pingMarkersRef = useRef<google.maps.Marker[]>([]);
  const renderedPingTimestampsRef = useRef<Set<number>>(new Set());

  // Stable callback ref for onRouteCalculated
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  onRouteCalculatedRef.current = onRouteCalculated;

  // ========== Initialize map ONCE ==========
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || !window.google?.maps || googleMapRef.current) return;

      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: KONSTANZ_CENTER,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      });
    };

    if (window.google?.maps) { init(); return; }
    const iv = setInterval(() => { if (window.google?.maps) { clearInterval(iv); init(); } }, 200);
    return () => clearInterval(iv);
  }, []);

  // ========== Pickup/Dropoff markers — only when markers actually change by VALUE ==========
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    // Skip if markers haven't changed by value (prevents unnecessary marker recreation)
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
          ? { text: marker.label, color: '#fff', fontSize: '12px', fontWeight: 'bold' }
          : undefined,
      });
      markersRef.current.push(m);
    });

    // fitBounds only ONCE when markers are first set
    if (markers.length > 0 && !hasCenteredRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      googleMapRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
      hasCenteredRef.current = true;
    }
  }, [markers]);

  // ========== Route — only when markers change ==========
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;
    if (!showRoute || markers.length < 2) return;

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#22C55E', strokeWeight: 4 },
      });
      directionsRendererRef.current.setMap(googleMapRef.current);
    }

    new window.google.maps.DirectionsService().route(
      {
        origin: { lat: markers[0].lat, lng: markers[0].lng },
        destination: { lat: markers[markers.length - 1].lat, lng: markers[markers.length - 1].lng },
        travelMode: window.google.maps.TravelMode.BICYCLING,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, status: any) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current!.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg?.distance?.value && onRouteCalculatedRef.current) {
            onRouteCalculatedRef.current(leg.distance.value / 1000);
          }
        }
      }
    );
  }, [markers, showRoute]);

  // ========== Driver marker for live tracking (Track page) ==========
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    if (!driverLocation) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      return;
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        position: driverLocation,
        map: googleMapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        title: 'Kurier',
      });
    } else {
      driverMarkerRef.current.setPosition(driverLocation);
    }
  }, [driverLocation]);

  // ========== Available drivers as green dots (Book page) ==========
  // Uses google.maps.Marker which handles geo-positioning automatically.
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;

    const currentIds = new Set(availableDrivers.map((d) => d.id));
    const markerMap = driverMarkerMapRef.current;

    // Remove markers for drivers that are no longer available
    markerMap.forEach((m, id) => {
      if (!currentIds.has(id)) {
        m.setMap(null);
        markerMap.delete(id);
      }
    });

    // Add or move markers for current drivers
    availableDrivers.forEach((driver) => {
      const lat = parseFloat(String(driver.latitude));
      const lng = parseFloat(String(driver.longitude));
      if (isNaN(lat) || isNaN(lng)) return;

      const existing = markerMap.get(driver.id);
      if (existing) {
        existing.setPosition({ lat, lng });
      } else {
        const m = new window.google.maps.Marker({
          position: { lat, lng },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#22C55E',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: `${driver.vehicle_type === 'bicycle' ? 'Fahrrad' : 'Lastenrad'} Kurier`,
          zIndex: 5,
        });
        markerMap.set(driver.id, m);
      }
    });
  }, [availableDrivers]);

  // ========== Location Pings — incremental (Track page) ==========
  // Uses google.maps.Marker which handles geo-positioning automatically.
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;
    if (locationPings.length === 0) return;

    const newPings = locationPings.filter(
      (p) => !renderedPingTimestampsRef.current.has(p.timestamp)
    );
    if (newPings.length === 0) return;

    const sorted = [...locationPings].sort((a, b) => a.timestamp - b.timestamp);
    const newestTimestamp = sorted[sorted.length - 1]?.timestamp;

    // Demote old "newest" markers to gray
    if (newPings.some((p) => p.timestamp === newestTimestamp)) {
      pingMarkersRef.current.forEach((m) => {
        m.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#9CA3AF',
          fillOpacity: 0.7,
          strokeColor: '#fff',
          strokeWeight: 1,
        });
        m.setZIndex(1);
      });
    }

    // Add new ping markers
    newPings.forEach((ping) => {
      const isNewest = ping.timestamp === newestTimestamp;
      const m = new window.google.maps.Marker({
        position: { lat: ping.lat, lng: ping.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isNewest ? 8 : 5,
          fillColor: isNewest ? '#22C55E' : '#9CA3AF',
          fillOpacity: isNewest ? 1 : 0.7,
          strokeColor: '#fff',
          strokeWeight: isNewest ? 2 : 1,
        },
        zIndex: isNewest ? 10 : 1,
      });
      pingMarkersRef.current.push(m);
      renderedPingTimestampsRef.current.add(ping.timestamp);
    });

    // Prune old markers (keep max 10)
    while (pingMarkersRef.current.length > 10) {
      const oldest = pingMarkersRef.current.shift();
      if (oldest) oldest.setMap(null);
    }
  }, [locationPings]);

  return (
    <div ref={containerRef} className={`w-full rounded-2xl overflow-hidden ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
