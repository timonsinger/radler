'use client';

import { useEffect, useRef } from 'react';
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
  const hasCenteredRef = useRef(false); // Karte nur beim ersten Fix zentrieren

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
  }, [markers, driverLocation]);

  // Route
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps || !showRoute || markers.length < 2) return;
    if (!dirRendererRef.current) {
      dirRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
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

  // Fahrer-Marker + Radius-Kreis
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

    if (!driverMarkerRef.current) {
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
      driverMarkerRef.current.setPosition(driverLocation);
    }

    // Radius-Kreis
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

    // Nur beim allerersten GPS-Fix zentrieren – danach nicht mehr springen
    if (isFirstFix && !hasCenteredRef.current) {
      googleMapRef.current.panTo(driverLocation);
      hasCenteredRef.current = true;
    }
  }, [driverLocation, radiusKm]);

  return <div ref={mapRef} className={`w-full rounded-2xl overflow-hidden ${className}`} />;
}
