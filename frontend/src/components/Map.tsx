'use client';

import { useEffect, useRef, useCallback } from 'react';
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

// CSS for driver dots and ping dots — injected once
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
  const overlayViewRef = useRef<google.maps.OverlayView | null>(null);
  const hasCenteredRef = useRef(false);

  // --- Driver overlays: managed imperatively, keyed by driver id ---
  const driverOverlayMapRef = useRef<globalThis.Map<string, HTMLDivElement>>(new globalThis.Map());

  // --- Ping overlays: managed incrementally ---
  const pingOverlaysRef = useRef<HTMLDivElement[]>([]);
  const renderedPingTimestampsRef = useRef<Set<number>>(new Set());

  // Keep latest props in refs so effects/listeners can read current values
  const locationPingsRef = useRef(locationPings);
  locationPingsRef.current = locationPings;
  const availableDriversRef = useRef(availableDrivers);
  availableDriversRef.current = availableDrivers;

  // Stable callback ref for onRouteCalculated
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  onRouteCalculatedRef.current = onRouteCalculated;

  // Helper: reposition a single overlay div to a lat/lng
  const positionOverlay = useCallback((el: HTMLDivElement, lat: number, lng: number) => {
    const ov = overlayViewRef.current;
    if (!ov) return;
    try {
      const proj = ov.getProjection();
      if (!proj) return;
      const point = proj.fromLatLngToDivPixel(new window.google.maps.LatLng(lat, lng));
      if (!point) return;
      el.style.left = `${point.x}px`;
      el.style.top = `${point.y}px`;
    } catch { /* projection not ready */ }
  }, []);

  // ========== Initialize map ONCE ==========
  useEffect(() => {
    ensurePulseStyles();
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

      // OverlayView for custom HTML overlays (driver dots & pings)
      const ov = new window.google.maps.OverlayView();
      ov.onAdd = () => {};
      ov.draw = () => {};
      ov.onRemove = () => {};
      ov.setMap(googleMapRef.current);
      overlayViewRef.current = ov;

      // Reposition all custom overlays on map pan/zoom
      googleMapRef.current.addListener('bounds_changed', () => {
        // Reposition driver dots
        const drivers = availableDriversRef.current;
        driverOverlayMapRef.current.forEach((el, driverId) => {
          const driver = drivers.find((d) => d.id === driverId);
          if (driver) {
            positionOverlay(el, parseFloat(String(driver.latitude)), parseFloat(String(driver.longitude)));
          }
        });
        // Reposition ping dots
        const pings = locationPingsRef.current;
        pingOverlaysRef.current.forEach((el) => {
          const ts = Number(el.dataset.timestamp);
          const ping = pings.find((p) => p.timestamp === ts);
          if (ping) positionOverlay(el, ping.lat, ping.lng);
        });
      });
    };

    if (window.google?.maps) { init(); return; }
    const iv = setInterval(() => { if (window.google?.maps) { clearInterval(iv); init(); } }, 200);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Pickup/Dropoff markers — only when markers change ==========
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

  // ========== Available drivers as pulsing dots (Book page) ==========
  // Imperative update: add new dots, move existing dots, remove gone dots.
  // NEVER recreate all overlays — that causes flashing and map reset.
  useEffect(() => {
    const map = googleMapRef.current;
    if (!map || !window.google?.maps) return;

    const ov = overlayViewRef.current;
    if (!ov) return;

    // Wait for overlay projection to be ready
    const update = () => {
      try {
        const proj = ov.getProjection();
        if (!proj) return;
        const pane = ov.getPanes()?.overlayMouseTarget;
        if (!pane) return;

        const currentIds = new Set(availableDrivers.map((d) => d.id));
        const overlayMap = driverOverlayMapRef.current;

        // Remove dots for drivers that are no longer available
        overlayMap.forEach((el, id) => {
          if (!currentIds.has(id)) {
            el.parentNode?.removeChild(el);
            overlayMap.delete(id);
          }
        });

        // Add or move dots for current drivers
        availableDrivers.forEach((driver) => {
          const lat = parseFloat(String(driver.latitude));
          const lng = parseFloat(String(driver.longitude));
          if (isNaN(lat) || isNaN(lng)) return;

          let el = overlayMap.get(driver.id);
          if (!el) {
            // Create new dot
            el = document.createElement('div');
            el.className = 'driver-dot-pulse';
            el.title = `${driver.vehicle_type === 'bicycle' ? 'Fahrrad' : 'Lastenrad'} Kurier`;
            pane.appendChild(el);
            overlayMap.set(driver.id, el);
          }
          // Position (move) the dot
          positionOverlay(el, lat, lng);
        });
      } catch { /* projection not ready yet */ }
    };

    // Run after a brief delay to ensure projection is ready
    const timeout = setTimeout(update, 300);
    return () => clearTimeout(timeout);
  }, [availableDrivers, positionOverlay]);

  // ========== Location Pings — incremental (Track page) ==========
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

    // Demote old "newest" dots
    if (newPings.some((p) => p.timestamp === newestTimestamp)) {
      pingOverlaysRef.current.forEach((el) => {
        if (el.dataset.newest === 'true') {
          el.dataset.newest = 'false';
          el.classList.remove('ping-dot-new');
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.background = 'rgba(156,163,175,0.7)';
          el.style.border = '1.5px solid rgba(255,255,255,0.5)';
          el.style.boxShadow = 'none';
        }
      });
    }

    const renderNewPings = () => {
      const ov = overlayViewRef.current;
      if (!ov) return;
      try {
        const proj = ov.getProjection();
        if (!proj) return;
        const pane = ov.getPanes()?.overlayMouseTarget;
        if (!pane) return;

        newPings.forEach((ping) => {
          const isNewest = ping.timestamp === newestTimestamp;
          const size = isNewest ? 16 : 10;
          const color = isNewest ? '#22C55E' : 'rgba(156,163,175,0.7)';
          const border = isNewest ? '2.5px solid white' : '1.5px solid rgba(255,255,255,0.5)';
          const shadow = isNewest ? '0 2px 8px rgba(34,197,94,0.5)' : 'none';

          const el = document.createElement('div');
          el.className = `ping-dot${isNewest ? ' ping-dot-new' : ''}`;
          el.dataset.newest = isNewest ? 'true' : 'false';
          el.dataset.timestamp = String(ping.timestamp);

          const point = proj.fromLatLngToDivPixel(new window.google.maps.LatLng(ping.lat, ping.lng));
          if (point) {
            el.style.cssText = `
              left: ${point.x}px;
              top: ${point.y}px;
              width: ${size}px;
              height: ${size}px;
              background: ${color};
              border: ${border};
              box-shadow: ${shadow};
              z-index: ${isNewest ? 10 : 1};
            `;
            pane.appendChild(el);
            pingOverlaysRef.current.push(el);
            renderedPingTimestampsRef.current.add(ping.timestamp);
          }
        });

        // Prune old overlays (keep max 10)
        while (pingOverlaysRef.current.length > 10) {
          const oldest = pingOverlaysRef.current.shift();
          if (oldest) {
            oldest.parentNode?.removeChild(oldest);
            const ts = Number(oldest.dataset.timestamp);
            if (!isNaN(ts)) renderedPingTimestampsRef.current.delete(ts);
          }
        }
      } catch { /* projection not ready */ }
    };

    const timeout = setTimeout(renderNewPings, 100);
    return () => clearTimeout(timeout);
  }, [locationPings]);

  return (
    <div ref={containerRef} className={`w-full rounded-2xl overflow-hidden ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
