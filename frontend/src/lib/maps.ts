// Konstanz Koordinaten
export const KONSTANZ_CENTER = { lat: 47.6779, lng: 9.1732 };

// Bounds für Autocomplete (ca. 25km um Konstanz)
export const KONSTANZ_BOUNDS = {
  north: 47.85,
  south: 47.50,
  east: 9.45,
  west: 8.90,
};

// Preiskonstanten
export const PRICING = {
  bicycle: { base: 4.00, perKm: 1.50, min: 5.50 },
  cargo_bike: { base: 6.00, perKm: 2.00, min: 8.00 },
};

export const RIKSCHA_PRICING = {
  rikscha: { taxiBase: 5.00, taxiPerKm: 4.00, taxiMin: 13.00, tourPerHour: 40.00, maxPassengers: 2 },
  rikscha_xl: { taxiBase: 8.00, taxiPerKm: 5.00, taxiMin: 18.00, tourPerHour: 60.00, maxPassengers: 4 },
  tandem: { taxiBase: 4.00, taxiPerKm: 3.00, taxiMin: 10.00, tourPerHour: 30.00, maxPassengers: 1 },
};

export type RikschaVehicle = 'rikscha' | 'rikscha_xl' | 'tandem';

// Preis berechnen (gleiche Logik wie Backend)
export function calculatePrice(vehicleType: 'bicycle' | 'cargo_bike', distanceKm: number): number {
  const p = PRICING[vehicleType];
  return Math.max(p.min, p.base + distanceKm * p.perKm);
}

export function calculateRikschaPrice(vehicleType: RikschaVehicle, mode: 'taxi' | 'tour', distanceKm: number, tourHours: number): number {
  const p = RIKSCHA_PRICING[vehicleType];
  if (mode === 'taxi') {
    return Math.max(p.taxiMin, p.taxiBase + distanceKm * p.taxiPerKm);
  }
  return tourHours * p.tourPerHour;
}

// Preis formatieren
export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',') + ' €';
}

// Distanz formatieren
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Status-Label auf Deutsch
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Suche Fahrer...',
    scheduled: 'Geplant – wartet auf Startzeit',
    accepted: 'Fahrer unterwegs zu dir',
    picked_up: 'Unterwegs',
    delivered: 'Abgeschlossen ✓',
    cancelled: 'Storniert',
    expired: 'Abgelaufen – kein Fahrer gefunden',
  };
  return labels[status] || status;
}

// Datum formatieren
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Google Maps Script laden (nur einmal)
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.maps) return resolve();
    if (document.getElementById('google-maps-script')) {
      // Script lädt bereits – warten
      const check = setInterval(() => {
        if (window.google?.maps) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

// TypeScript Typen für Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}
