import { calculatePrice, formatPrice, formatDistance, PRICING } from '@/lib/maps';

interface Props {
  vehicleType: 'bicycle' | 'cargo_bike';
  distanceKm: number;
}

export default function PriceDisplay({ vehicleType, distanceKm }: Props) {
  const price = calculatePrice(vehicleType, distanceKm);
  const p = PRICING[vehicleType];
  const kmCost = distanceKm * p.perKm;

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Preisaufschlüsselung</p>
        <p className="text-sm text-gray-400">{formatDistance(distanceKm)}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Grundgebühr</span>
          <span className="text-gray-900">{formatPrice(p.base)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{distanceKm.toFixed(1)} km × {formatPrice(p.perKm)}</span>
          <span className="text-gray-900">{formatPrice(kmCost)}</span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
          <span className="font-bold text-gray-900">Gesamt</span>
          <span className="text-xl font-black text-primary">{formatPrice(price)}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center">Bezahlung: Bar bei Lieferung</p>
    </div>
  );
}
