import Link from 'next/link';
import { formatPrice, formatDate } from '@/lib/maps';

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  created_at: string;
  vehicle_type: string;
}

/* 4d: Status-Badges */
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[#FFF8E7] text-[#9E9E9E]',
  accepted: 'bg-[#E3F2FD] text-[#1565C0]',
  picked_up: 'bg-[#1A1A1A] text-white',
  delivered: 'bg-[#E8F5E9] text-[#1B5E20]',
  cancelled: 'bg-[#FFF0EC] text-[#C44525]',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Suche Kurier',
  accepted: 'Angenommen',
  picked_up: 'Unterwegs',
  delivered: 'Zugestellt',
  cancelled: 'Storniert',
};

export default function RideCard({ ride }: { ride: Ride }) {
  const isActive = ['pending', 'accepted', 'picked_up'].includes(ride.status);
  const isCancelled = ride.status === 'cancelled';

  const card = (
    <div
      className={`bg-white rounded-[16px] p-[18px_20px] border ${
        isActive ? 'border-radler-green-100' : 'border-radler-ink-100'
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header: Badge + Preis */}
      <div className="flex items-start justify-between mb-3">
        <span
          className={`font-body font-semibold text-xs px-3.5 py-[5px] rounded-[20px] ${
            STATUS_STYLES[ride.status] || 'bg-[#F5F5F5] text-[#9E9E9E]'
          }`}
        >
          {STATUS_LABELS[ride.status] || ride.status}
        </span>
        <div className="text-right">
          <span className={`font-heading font-bold text-xl ${isCancelled ? 'line-through text-radler-ink-300' : 'text-radler-ink-800'}`}>
            {formatPrice(Number(ride.price))}
          </span>
          <p className="font-mono text-[10px] text-radler-ink-300 mt-0.5">
            {ride.vehicle_type === 'bicycle' ? '🚲 Kurier' : '🚛 Lastenrad'}
          </p>
        </div>
      </div>

      {/* Route-Visualisierung */}
      <div className="flex gap-3">
        {/* Dots + Linie */}
        <div className="flex flex-col items-center py-1">
          <div
            className="w-[10px] h-[10px] rounded-full flex-shrink-0"
            style={{
              background: isCancelled ? '#BDBDBD' : '#2E7D32',
              border: isCancelled ? '2px solid #E0E0E0' : '2px solid #C8E6C9',
            }}
          />
          <div
            className="w-[2px] flex-1 my-1"
            style={{
              background: isCancelled
                ? '#E0E0E0'
                : 'linear-gradient(to bottom, #2E7D32, #E85D3A)',
            }}
          />
          <div
            className="w-[10px] h-[10px] rounded-full flex-shrink-0"
            style={{
              background: isCancelled ? '#BDBDBD' : '#E85D3A',
              border: isCancelled ? '2px solid #E0E0E0' : '2px solid #FFDDD4',
            }}
          />
        </div>
        {/* Adressen */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <p className={`font-body text-[13px] line-clamp-1 ${isCancelled ? 'text-radler-ink-300' : 'text-radler-ink-600'}`}>
            {ride.pickup_address}
          </p>
          <p className={`font-body text-[13px] line-clamp-1 ${isCancelled ? 'text-radler-ink-300' : 'text-radler-ink-600'}`}>
            {ride.dropoff_address}
          </p>
        </div>
      </div>

      {/* Footer: Datum + ID */}
      <div className="border-t border-radler-ink-100 mt-3 pt-2.5 flex items-center justify-between">
        <span className="font-mono text-[11px] text-radler-ink-300">{formatDate(ride.created_at)}</span>
        <span className="font-mono text-[11px] text-radler-ink-300">#{ride.id.slice(0, 8)}</span>
      </div>
    </div>
  );

  if (isActive) {
    return <Link href={`/track/${ride.id}`}>{card}</Link>;
  }
  return card;
}
