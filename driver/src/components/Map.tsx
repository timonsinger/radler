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
  showCenterButton?: boolean;
  isOnline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Map({ markers = [], driverLocation, showRoute, radiusKm, showCenterButton, isOnline = true, className = '', style }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const radiusCircleRef = useRef<google.maps.Circle | null>(null);
  const prevMarkersKeyRef = useRef('');
  const initialCenterDone = useRef(false);

  useEffect(() => {
    const init = () => {
      if (!mapRef.current || !window.google?.maps || googleMapRef.current) return;
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: driverLocation ?? KONSTANZ_CENTER,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: false,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      });
    };
    if (window.google?.maps) { init(); return; }
    const iv = setInterval(() => { if (window.google?.maps) { clearInterval(iv); init(); } }, 200);
    return () => clearInterval(iv);
  }, []);

  // Marker setzen — fitBounds nur wenn sich Marker tatsächlich ändern
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    const key = JSON.stringify(markers);
    const markersChanged = key !== prevMarkersKeyRef.current;
    if (!markersChanged) return;
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
        label: marker.label ? { text: marker.label, color: '#fff', fontSize: '11px', fontWeight: 'bold' } : undefined,
      });
      markersRef.current.push(m);
    });
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      if (driverLocation) bounds.extend(driverLocation);
      googleMapRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 30, right: 30 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // Route — nur einmal berechnen wenn sich Marker ändern
  const prevRouteKeyRef = useRef('');
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps || !showRoute || markers.length < 2) return;

    const routeKey = JSON.stringify(markers.map(m => ({ lat: m.lat, lng: m.lng })));
    if (routeKey === prevRouteKeyRef.current) return;
    prevRouteKeyRef.current = routeKey;

    if (!dirRendererRef.current) {
      dirRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#14532D', strokeWeight: 5 },
      });
      dirRendererRef.current.setMap(googleMapRef.current);
    }
    new window.google.maps.DirectionsService().route({
      origin: { lat: markers[0].lat, lng: markers[0].lng },
      destination: { lat: markers[markers.length - 1].lat, lng: markers[markers.length - 1].lng },
      travelMode: window.google.maps.TravelMode.BICYCLING,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, (result: any, status: any) => {
      if (status === 'OK' && result) dirRendererRef.current!.setDirections(result);
    });
  }, [markers, showRoute]);

  // Zoom passend zum Radius berechnen
  const fitToRadius = useCallback(() => {
    if (!googleMapRef.current || !driverLocation || !radiusKm || radiusKm <= 0) return;
    const circle = new window.google.maps.Circle({
      center: driverLocation,
      radius: radiusKm * 1000,
    });
    googleMapRef.current.fitBounds(circle.getBounds()!, { top: 20, bottom: 20, left: 20, right: 20 });
  }, [driverLocation, radiusKm]);

  // Einmal auf aktuelle Position zentrieren wenn GPS verfügbar wird
  useEffect(() => {
    if (!googleMapRef.current || !driverLocation || initialCenterDone.current) return;
    googleMapRef.current.setCenter(driverLocation);
    if (!isOnline && radiusKm && radiusKm > 0) {
      fitToRadius();
    } else {
      googleMapRef.current.setZoom(15);
    }
    initialCenterDone.current = true;
  }, [driverLocation, isOnline, radiusKm, fitToRadius]);

  // Offline: bei Radius-Änderung auf Kreis zoomen
  useEffect(() => {
    if (!googleMapRef.current || !driverLocation || isOnline) return;
    if (radiusKm && radiusKm > 0) {
      fitToRadius();
    }
  }, [radiusKm, isOnline, driverLocation, fitToRadius]);

  const centerOnDriver = useCallback(() => {
    if (!googleMapRef.current || !driverLocation) return;
    googleMapRef.current.panTo(driverLocation);
    if (!isOnline && radiusKm && radiusKm > 0) {
      fitToRadius();
    } else {
      googleMapRef.current.setZoom(15);
    }
  }, [driverLocation, isOnline, radiusKm, fitToRadius]);

  // Fahrer-Marker + Radius-Kreis
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;

    if (!driverLocation) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
      return;
    }

    const markerColor = isOnline ? '#2E7D32' : '#9E9E9E';
    const markerIcon = {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: markerColor,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2.5,
    };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new window.google.maps.Marker({
        position: driverLocation,
        map: googleMapRef.current,
        icon: markerIcon,
        title: 'Du',
        zIndex: 10,
      });
    } else {
      driverMarkerRef.current.setPosition(driverLocation);
      driverMarkerRef.current.setIcon(markerIcon);
    }

    // Radius-Kreis
    const circleColor = isOnline ? '#22C55E' : '#BDBDBD';
    if (radiusKm && radiusKm > 0) {
      if (!radiusCircleRef.current) {
        radiusCircleRef.current = new window.google.maps.Circle({
          map: googleMapRef.current,
          center: driverLocation,
          radius: radiusKm * 1000,
          fillColor: circleColor,
          fillOpacity: 0.08,
          strokeColor: circleColor,
          strokeWeight: 1.5,
          strokeOpacity: 0.5,
        });
      } else {
        radiusCircleRef.current.setCenter(driverLocation);
        radiusCircleRef.current.setRadius(radiusKm * 1000);
        radiusCircleRef.current.setOptions({
          fillColor: circleColor,
          strokeColor: circleColor,
        });
      }
    } else {
      radiusCircleRef.current?.setMap(null);
      radiusCircleRef.current = null;
    }
  }, [driverLocation, radiusKm, isOnline]);

  return (
    <div className="relative">
      <div ref={mapRef} className={`w-full rounded-2xl overflow-hidden ${className}`} style={style} />
      {showCenterButton && driverLocation && (
        <button
          onClick={(e) => { e.stopPropagation(); centerOnDriver(); }}
          className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center active:bg-gray-100 z-10"
          title="Auf mich zentrieren"
        >
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
          </svg>
        </button>
      )}
    </div>
  );
}
