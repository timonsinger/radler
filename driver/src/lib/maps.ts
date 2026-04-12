export const KONSTANZ_CENTER = { lat: 47.6779, lng: 9.1732 };

export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',') + ' €';
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.maps) return resolve();
    if (document.getElementById('google-maps-script')) {
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

declare global {
  interface Window {
    google: typeof google;
  }
}
