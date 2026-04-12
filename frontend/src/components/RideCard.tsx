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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-blue-700',
  picked_up: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Suche Kurier',
  accepted: 'Kurier kommt',
  picked_up: 'Unterwegs',
  delivered: 'Zugestellt',
  cancelled: 'Storniert',
};

export default function RideCard({ ride }: { ride: Ride }) {
  const isActive = ['pending', 'accepted', 'picked_up'].includes(ride.status);
  const card = (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${isActive ? 'border-primary/30' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[ride.status] || 'bg-gray-100 text-gray-500'}`}>
          {STATUS_LABELS[ride.status] || ride.status}
        </span>
        <div className="text-right">
          <span className="font-bold text-gray-900">{formatPrice(Number(ride.price))}</span>
          <p className="text-xs text-gray-400 mt-0.5">{ride.vehicle_type === 'bicycle' ? '🚲' : '🚛'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 line-clamp-1">{ride.pickup_address}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-error mt-1.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 line-clamp-1">{ride.dropoff_address}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">{formatDate(ride.created_at)}</p>
    </div>
  );

  if (isActive) {
    return <Link href={`/track/${ride.id}`}>{card}</Link>;
  }
  return card;
}
