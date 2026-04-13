'use client';

import { useEffect, useRef, useState } from 'react';
import { KONSTANZ_BOUNDS } from '@/lib/maps';

interface AddressResult {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  placeholder: string;
  value: string;
  onSelect: (result: AddressResult) => void;
  onChange?: (value: string) => void;
}

export default function AddressInput({ placeholder, value, onSelect, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      if (autocompleteRef.current) return;

      const bounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(KONSTANZ_BOUNDS.south, KONSTANZ_BOUNDS.west),
        new window.google.maps.LatLng(KONSTANZ_BOUNDS.north, KONSTANZ_BOUNDS.east)
      );

      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        bounds,
        strictBounds: false,
        types: ['geocode'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        if (place.geometry?.location) {
          onSelect({
            address: place.formatted_address || place.name || '',
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
      setReady(true);
    };

    if (window.google?.maps?.places) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(interval); init(); }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [onSelect]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full font-body px-4 py-3.5 rounded-[12px] border border-radler-ink-200 bg-white text-radler-ink-800 placeholder-radler-ink-400 text-sm focus:outline-none focus:ring-2 focus:ring-radler-green-500/30 focus:border-radler-green-500"
      />
      {!ready && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-radler-ink-200 border-t-radler-green-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
