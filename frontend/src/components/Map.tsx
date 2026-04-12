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

// CSS für pulsierende Fahrer-Punkte (einmalig in den DOM injizieren)
function ensurePulseStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('map-pulse-styles')) return;
  const style = document.createElement('style');
  style.id = 'map-pulse-styles';
  style.textContent = `
    @keyframes driverPulse {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      70% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
    }
    @keyframes pingAppear {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
      60% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.6; }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    .driver-dot-pulse {
      position: absolute;
      width: 14px;
      height: 14px;
      background: #22C55E;
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .driver-dot-pulse::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      background: #22C55E;
      border-radius: 50%;
      top: 0; left: 0;
      animation: driverPulse 2s ease-out infinite;
    }
    .ping-dot {
      position: absolute;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.3s ease;
    }
    .ping-dot-new {
      animation: pingAppear 0.6s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
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
  const driverOverlaysRef = useRef<HTMLDivElement[]>([]);
  const pingOverlaysRef = useRef<HTMLDivElement[]>([]);
  const overlayViewRef = useRef<google.maps.OverlayView | null>(null);

  // Karte initialisieren
  useEffect(() => {
    ensurePulseStyles();
    const init = () => {
      if (!mapRef.current || !window.google?.maps) return;
      if (googleMapRef.current) return;

      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: KONSTANZ_CENTER,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      });

      // OverlayView für Custom-HTML-Overlays (Fahrer-Punkte & Pings)
      const ov = new window.google.maps.OverlayView();
      ov.onAdd = () => {};
      ov.draw = () => {};
      ov.onRemove = () => {};
      ov.setMap(googleMapRef.current);
      overlayViewRef.current = ov;
    };

    if (window.google?.maps) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps) { clearInterval(interval); init(); }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  // Marker setzen
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

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
        label: marker.label ? { text: marker.label, color: '#fff', fontSize: '12px', fontWeight: 'bold' } : undefined,
      });
      markersRef.current.push(m);
    });

    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      googleMapRef.current.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
    }
  }, [markers]);

  // Route zeichnen
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

    const service = new window.google.maps.DirectionsService();
    service.route(
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
          if (leg?.distance?.value && onRouteCalculated) {
            onRouteCalculated(leg.distance.value / 1000);
          }
        }
      }
    );
  }, [markers, showRoute, onRouteCalculated]);

  // Fahrer-Marker (live tracking)
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

  // Verfügbare Fahrer als pulsierende Punkte
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;

    // Alte Overlays entfernen
    driverOverlaysRef.current.forEach((el) => el.parentNode?.removeChild(el));
    driverOverlaysRef.current = [];

    if (availableDrivers.length === 0) return;

    // Warten bis OverlayView projection verfügbar
    const render = () => {
      const ov = overlayViewRef.current;
      if (!ov) return;
      try {
        const proj = ov.getProjection();
        if (!proj) return;

        const pane = ov.getPanes()?.overlayMouseTarget;
        if (!pane) return;

        availableDrivers.forEach((driver) => {
          const lat = parseFloat(String(driver.latitude));
          const lng = parseFloat(String(driver.longitude));
          if (isNaN(lat) || isNaN(lng)) return;

          const point = proj.fromLatLngToDivPixel(
            new window.google.maps.LatLng(lat, lng)
          );
          if (!point) return;

          const el = document.createElement('div');
          el.className = 'driver-dot-pulse';
          el.style.left = `${point.x}px`;
          el.style.top = `${point.y}px`;
          el.title = `${driver.vehicle_type === 'bicycle' ? 'Fahrrad' : 'Lastenrad'} Kurier`;
          pane.appendChild(el);
          driverOverlaysRef.current.push(el);
        });
      } catch { /* Projection noch nicht bereit */ }
    };

    // Kurz warten und dann rendern; auch bei Kartenänderungen aktualisieren
    const timeout = setTimeout(render, 300);
    const listener = map.addListener('bounds_changed', render);

    return () => {
      clearTimeout(timeout);
      window.google?.maps.event.removeListener(listener);
    };
  }, [availableDrivers]);

  // Location Pings (30-Sekunden-Trail)
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;

    pingOverlaysRef.current.forEach((el) => el.parentNode?.removeChild(el));
    pingOverlaysRef.current = [];

    if (locationPings.length === 0) return;

    const render = () => {
      const ov = overlayViewRef.current;
      if (!ov) return;
      try {
        const proj = ov.getProjection();
        if (!proj) return;
        const pane = ov.getPanes()?.overlayMouseTarget;
        if (!pane) return;

        // Älteste zuerst rendern (werden von neueren überlagert)
        const sorted = [...locationPings].sort((a, b) => a.timestamp - b.timestamp);
        const newest = sorted[sorted.length - 1];

        sorted.forEach((ping, i) => {
          const isNewest = ping.timestamp === newest?.timestamp;
          const age = sorted.length - 1 - i; // 0 = neuester

          const point = proj.fromLatLngToDivPixel(
            new window.google.maps.LatLng(ping.lat, ping.lng)
          );
          if (!point) return;

          const size = isNewest ? 16 : Math.max(6, 14 - age * 1.5);
          const opacity = isNewest ? 1 : Math.max(0.2, 1 - age * 0.1);
          const color = isNewest ? '#22C55E' : `rgba(156,163,175,${opacity})`;

          const el = document.createElement('div');
          el.className = `ping-dot${isNewest ? ' ping-dot-new' : ''}`;
          el.style.cssText = `
            left: ${point.x}px;
            top: ${point.y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: ${isNewest ? '2.5px' : '1.5px'} solid ${isNewest ? 'white' : 'rgba(255,255,255,0.5)'};
            box-shadow: ${isNewest ? '0 2px 8px rgba(34,197,94,0.5)' : 'none'};
            z-index: ${isNewest ? 10 : i};
          `;
          pane.appendChild(el);
          pingOverlaysRef.current.push(el);
        });
      } catch { /* Projection noch nicht bereit */ }
    };

    const timeout = setTimeout(render, 300);
    const listener = map.addListener('bounds_changed', render);

    return () => {
      clearTimeout(timeout);
      window.google?.maps.event.removeListener(listener);
    };
  }, [locationPings]);

  return <div ref={containerRef} className={`w-full rounded-2xl overflow-hidden ${className}`}>
    <div ref={mapRef} className="w-full h-full" />
  </div>;
}
