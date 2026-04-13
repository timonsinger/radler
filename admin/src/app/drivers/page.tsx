'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import AdminLayout from '@/components/AdminLayout';

export default function DriversPageWrapper() {
  return (
    <Suspense fallback={<AdminLayout title="Fahrer"><p className="text-gray-400">Laden...</p></AdminLayout>}>
      <DriversPage />
    </Suspense>
  );
}

interface Driver {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  vehicle_type: string | null;
  is_online: boolean;
  is_approved: boolean;
  onboarding_completed: boolean;
  rating: number | null;
  total_rides: number;
  total_earnings: number;
  created_at: string;
  last_online: string | null;
}

type Tab = 'all' | 'pending' | 'online' | 'offline';

function DriversPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('approved') === 'false' ? 'pending' : 'all';

  const [tab, setTab] = useState<Tab>(initialTab as Tab);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);

    if (tab === 'pending') {
      apiFetch('/api/admin/drivers/pending')
        .then((data) => {
          setDrivers(data.drivers);
          setTotal(data.drivers.length);
          setTotalPages(1);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (tab === 'online') params.set('status', 'online');
      if (tab === 'offline') params.set('status', 'offline');

      apiFetch(`/api/admin/drivers?${params}`)
        .then((data) => {
          setDrivers(data.drivers);
          setTotal(data.total);
          setPendingCount(data.pendingApprovals);
          setTotalPages(Math.ceil(data.total / 50));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  const approve = async (userId: string) => {
    setActionLoading(userId);
    try {
      await apiFetch(`/api/admin/drivers/${userId}/approve`, { method: 'PATCH' });
      load();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const reject = async (userId: string) => {
    const reason = prompt('Grund für die Ablehnung:');
    if (!reason) return;
    setActionLoading(userId);
    try {
      await apiFetch(`/api/admin/drivers/${userId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      load();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const forceOffline = async (userId: string, name: string) => {
    if (!confirm(`Fahrer ${name} offline schalten?`)) return;
    setActionLoading(userId);
    try {
      await apiFetch(`/api/admin/drivers/${userId}/force-offline`, { method: 'PATCH' });
      load();
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'pending', label: `Freischaltung (${pendingCount})` },
    { key: 'online', label: 'Online' },
    { key: 'offline', label: 'Offline' },
  ];

  return (
    <AdminLayout title="Fahrer">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending Cards View */}
      {tab === 'pending' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.length === 0 && !loading && (
            <p className="text-gray-400 col-span-3 text-center py-8">Keine Fahrer warten auf Freischaltung</p>
          )}
          {drivers.map((d) => (
            <div key={d.user_id} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <div>
                <p className="font-semibold text-gray-900">{d.name}</p>
                <p className="text-sm text-gray-500">{d.email}</p>
                {d.phone && <p className="text-sm text-gray-500">{d.phone}</p>}
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Fahrzeug:</span>{' '}
                  <span>{d.vehicle_type === 'bicycle' ? 'Fahrrad' : d.vehicle_type === 'cargo_bike' ? 'Lastenrad' : 'Nicht gesetzt'}</span>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Registriert:</span> {formatDate(d.created_at)}
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Onboarding:</span>{' '}
                <span className={d.onboarding_completed ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {d.onboarding_completed ? 'Abgeschlossen' : 'Nicht abgeschlossen'}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => approve(d.user_id)}
                  disabled={actionLoading === d.user_id}
                  className="flex-1 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === d.user_id ? '...' : 'Freischalten'}
                </button>
                <button
                  onClick={() => reject(d.user_id)}
                  disabled={actionLoading === d.user_id}
                  className="flex-1 bg-red-100 text-red-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Bewertung</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fahrten</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Verdienst</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Freigeschaltet</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map((d) => (
                <tr key={d.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.vehicle_type === 'bicycle' ? 'Fahrrad' : d.vehicle_type === 'cargo_bike' ? 'Lastenrad' : '–'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.rating ? (
                      <span className="text-yellow-500">{Number(d.rating).toFixed(1)} ★</span>
                    ) : '–'}
                  </td>
                  <td className="px-4 py-3 text-right">{d.total_rides}</td>
                  <td className="px-4 py-3 text-right">{formatPrice(Number(d.total_earnings))}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${d.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs">{d.is_online ? 'Online' : 'Offline'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.is_approved ? (
                      <span className="text-xs text-green-600 font-medium">Ja</span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">Nein</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.is_online && (
                      <button
                        onClick={() => forceOffline(d.user_id, d.name)}
                        disabled={actionLoading === d.user_id}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === d.user_id ? '...' : 'Offline schalten'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">Keine Fahrer gefunden</td></tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Zurück</button>
              <span className="text-sm text-gray-500">Seite {page} von {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Weiter</button>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
