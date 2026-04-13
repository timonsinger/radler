'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatPrice, formatDate, statusLabel, statusColor } from '@/lib/utils';
import AdminLayout from '@/components/AdminLayout';
import RevenueChart from '@/components/RevenueChart';

type Period = 'today' | 'thisWeek' | 'thisMonth' | 'total';

interface Stats {
  rides: number;
  revenue: number;
  platformFees: number;
  newUsers: number;
  newDrivers: number;
  users?: number;
  drivers?: number;
  activeDrivers?: number;
  avgRating?: number | null;
}

interface Ride {
  id: string;
  created_at: string;
  customer_name: string;
  driver_name: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  status: string;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [stats, setStats] = useState<Record<Period, Stats> | null>(null);
  const [pending, setPending] = useState(0);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/dashboard').then((data) => {
      setStats(data.stats);
      setPending(data.pendingDriverApprovals);
    }).catch(console.error);

    apiFetch('/api/admin/rides?page=1&limit=10').then((data) => {
      setRecentRides(data.rides);
    }).catch(console.error);

    apiFetch('/api/admin/stats/daily?days=30').then((data) => {
      setDailyStats(data.stats);
    }).catch(console.error);
  }, []);

  const s = stats?.[period];

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Heute' },
    { key: 'thisWeek', label: 'Diese Woche' },
    { key: 'thisMonth', label: 'Dieser Monat' },
    { key: 'total', label: 'Gesamt' },
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Period Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      {s && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Fahrten" value={String(s.rides)} />
          <MetricCard label="Umsatz" value={formatPrice(s.revenue)} />
          <MetricCard label="Deine Provision" value={formatPrice(s.platformFees)} highlight />
          <MetricCard label="Neue Nutzer" value={String(s.newUsers)} />
          <MetricCard label="Neue Fahrer" value={String(s.newDrivers)} />
          {period === 'total' && stats?.total ? (
            <MetricCard label="Aktive Fahrer" value={String(stats.total.activeDrivers || 0)} online />
          ) : (
            <MetricCard label="Neue Nutzer + Fahrer" value={String(s.newUsers + s.newDrivers)} />
          )}
        </div>
      )}

      {/* Pending Approvals Banner */}
      {pending > 0 && (
        <Link href="/drivers?approved=false">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between hover:bg-yellow-100 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-2xl">!</span>
              <p className="text-sm font-semibold text-yellow-800">{pending} Fahrer warten auf Freischaltung</p>
            </div>
            <span className="text-sm text-yellow-700 font-medium">Ansehen &rarr;</span>
          </div>
        </Link>
      )}

      {/* Revenue Chart */}
      {dailyStats.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz letzte 30 Tage</h3>
          <RevenueChart data={dailyStats} />
        </div>
      )}

      {/* Recent Rides */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Letzte Aufträge</h3>
          <Link href="/rides" className="text-sm text-primary font-medium hover:underline">Alle anzeigen</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Datum</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fahrer</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Route</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Preis</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentRides.map((ride) => (
              <tr key={ride.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-500">{formatDate(ride.created_at)}</td>
                <td className="px-6 py-3 text-gray-900">{ride.customer_name || '–'}</td>
                <td className="px-6 py-3 text-gray-900">{ride.driver_name || '–'}</td>
                <td className="px-6 py-3 text-gray-500 truncate max-w-[200px]">
                  {ride.pickup_address?.split(',')[0]} &rarr; {ride.dropoff_address?.split(',')[0]}
                </td>
                <td className="px-6 py-3 text-right font-medium">{formatPrice(Number(ride.price))}</td>
                <td className="px-6 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(ride.status)}`}>
                    {statusLabel(ride.status)}
                  </span>
                </td>
              </tr>
            ))}
            {recentRides.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Keine Aufträge</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function MetricCard({ label, value, highlight, online }: { label: string; value: string; highlight?: boolean; online?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${highlight ? 'bg-green-50 border border-green-200' : 'bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {online && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        <p className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      </div>
    </div>
  );
}
