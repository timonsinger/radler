import { calculatePrice, formatPrice, formatDistance } from '@/lib/maps';

interface Props {
  vehicleType: 'bicycle' | 'cargo_bike';
  distanceKm: number;
}

export default function PriceDisplay({ vehicleType, distanceKm }: Props) {
  const price = calculatePrice(vehicleType, distanceKm);

  return (
    <div className="bg-primary-light rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">Geschätzte Distanz</p>
        <p className="font-semibold text-gray-900">{formatDistance(distanceKm)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-600">Preis</p>
        <p className="text-2xl font-bold text-primary">{formatPrice(price)}</p>
      </div>
    </div>
  );
}
