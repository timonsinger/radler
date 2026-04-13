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
    <div className="bg-white rounded-[16px] p-4 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between">
        <p className="font-heading text-sm font-semibold text-radler-ink-700">Preisaufschlüsselung</p>
        <p className="font-mono text-sm text-radler-ink-300">{formatDistance(distanceKm)}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-body">
          <span className="text-radler-ink-500">Grundgebühr</span>
          <span className="font-mono text-radler-ink-800">{formatPrice(p.base)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-body">
          <span className="text-radler-ink-500">{distanceKm.toFixed(1)} km × {formatPrice(p.perKm)}</span>
          <span className="font-mono text-radler-ink-800">{formatPrice(kmCost)}</span>
        </div>
        <div className="border-t border-radler-ink-100 pt-2 flex items-center justify-between">
          <span className="font-heading font-bold text-radler-ink-800">Gesamt</span>
          <span className="font-heading text-xl font-bold text-radler-green-500">{formatPrice(price)}</span>
        </div>
      </div>
      <p className="font-body text-xs text-radler-ink-300 text-center">Bezahlung: Bar bei Lieferung</p>
    </div>
  );
}
