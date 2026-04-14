'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { formatPrice, formatDate, statusLabel, statusColor } from '@/lib/utils';
import AdminLayout from '@/components/AdminLayout';

interface Ride {
  id: string;
  created_at: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  price: number;
  platform_fee: number;
  driver_payout: number;
  vehicle_type: string;
  rating: number | null;
  delivery_photo_url: string | null;
  pickup_photo_url: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  pickup_method: string;
  delivery_method: string;
  description: string | null;
  service_type: string | null;
  passenger_count: number | null;
  tour_duration_hours: number | null;
  customer_name: string;
  customer_email: string;
  driver_name: string;
  driver_email: string;
}

interface ChatMessage {
  id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const STATUSES = ['all', 'pending', 'accepted', 'picked_up', 'delivered', 'cancelled', 'expired'];

export default function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filteredRevenue, setFilteredRevenue] = useState(0);
  const [filteredFees, setFilteredFees] = useState(0);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'chat'>('info');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const loadChat = useCallback((rideId: string) => {
    setChatLoading(true);
    apiFetch(`/api/rides/${rideId}/messages`)
      .then((data) => setChatMessages(data.messages || []))
      .catch(() => setChatMessages([]))
      .finally(() => setChatLoading(false));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search) params.set('customer', search);

    apiFetch(`/api/admin/rides?${params}`)
      .then((data) => {
        setRides(data.rides);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setFilteredRevenue(data.filteredRevenue);
        setFilteredFees(data.filteredPlatformFees);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, status, from, to, search]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await apiFetch(`/api/admin/export/rides?${params}`);
    const blob = await (res as Response).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radler-auftraege.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Aufträge">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'Alle' : statusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Von</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bis</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Suche (Kunde/Fahrer)</label>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name oder Email..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button onClick={exportCSV}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          CSV Export
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>{total} Aufträge</span>
        <span>|</span>
        <span>Umsatz: {formatPrice(filteredRevenue)}</span>
        <span>|</span>
        <span>Provision: {formatPrice(filteredFees)}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fahrer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">km</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preis</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Provision</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rides.map((ride) => (
                <tr key={ride.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedRide(ride); setDetailTab('info'); setChatMessages([]); }}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(ride.created_at)}</td>
                  <td className="px-4 py-3 text-gray-900">{ride.customer_name || '–'}</td>
                  <td className="px-4 py-3 text-gray-900">{ride.driver_name || '–'}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[180px]">
                    {ride.pickup_address?.split(',')[0]} &rarr; {ride.dropoff_address?.split(',')[0]}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{ride.distance_km ? Number(ride.distance_km).toFixed(1) : '–'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(Number(ride.price))}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{ride.platform_fee ? formatPrice(Number(ride.platform_fee)) : '–'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(ride.status)}`}>
                      {statusLabel(ride.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {rides.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">Keine Aufträge gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Zurück
            </button>
            <span className="text-sm text-gray-500">Seite {page} von {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Weiter
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedRide(null)} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Auftragsdetails</h3>
              <button onClick={() => setSelectedRide(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDetailTab('info')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${detailTab === 'info' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Details
              </button>
              <button
                onClick={() => { setDetailTab('chat'); loadChat(selectedRide.id); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${detailTab === 'chat' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Chat-Verlauf
              </button>
            </div>

            {detailTab === 'info' ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-400">Status:</span> <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(selectedRide.status)}`}>{statusLabel(selectedRide.status)}</span></div>
                  <div><span className="text-gray-400">Typ:</span> {selectedRide.service_type === 'rikscha_taxi' ? '🛺 Rikscha-Taxi' : selectedRide.service_type === 'rikscha_tour' ? '🗺 Stadt-Tour' : '📦 Kurier'}</div>
                  <div><span className="text-gray-400">Fahrzeug:</span> {selectedRide.vehicle_type === 'bicycle' ? 'Fahrrad' : selectedRide.vehicle_type === 'cargo_bike' ? 'Lastenrad' : selectedRide.vehicle_type === 'rikscha' ? 'Rikscha' : selectedRide.vehicle_type === 'rikscha_xl' ? 'Rikscha XL' : selectedRide.vehicle_type === 'tandem' ? 'Tandem' : selectedRide.vehicle_type}</div>
                  <div><span className="text-gray-400">Preis:</span> <strong>{formatPrice(Number(selectedRide.price))}</strong></div>
                  <div><span className="text-gray-400">Provision:</span> <strong className="text-green-700">{selectedRide.platform_fee ? formatPrice(Number(selectedRide.platform_fee)) : '–'}</strong></div>
                  <div><span className="text-gray-400">Fahrer-Verdienst:</span> {selectedRide.driver_payout ? formatPrice(Number(selectedRide.driver_payout)) : '–'}</div>
                  <div><span className="text-gray-400">Distanz:</span> {selectedRide.distance_km ? `${Number(selectedRide.distance_km).toFixed(1)} km` : '–'}</div>
                  <div><span className="text-gray-400">Bewertung:</span> {selectedRide.rating ? `${selectedRide.rating}/5` : '–'}</div>
                  {selectedRide.passenger_count && <div><span className="text-gray-400">Fahrgäste:</span> {selectedRide.passenger_count}</div>}
                  {selectedRide.tour_duration_hours && <div><span className="text-gray-400">Tour-Dauer:</span> {selectedRide.tour_duration_hours} Std.</div>}
                </div>

                {selectedRide.description && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                    <p className="text-amber-700 font-semibold text-xs mb-1">💬 Auftragsbeschreibung:</p>
                    <p className="text-amber-900 whitespace-pre-wrap">{selectedRide.description}</p>
                  </div>
                )}

                <div className="text-sm space-y-2">
                  <div><span className="text-gray-400">Abholung:</span><br />{selectedRide.pickup_address}</div>
                  <div><span className="text-gray-400">Ziel:</span><br />{selectedRide.dropoff_address}</div>
                </div>

                <div className="text-sm space-y-1">
                  <div><span className="text-gray-400">Kunde:</span> {selectedRide.customer_name} ({selectedRide.customer_email})</div>
                  <div><span className="text-gray-400">Fahrer:</span> {selectedRide.driver_name || '–'} {selectedRide.driver_email ? `(${selectedRide.driver_email})` : ''}</div>
                </div>

                {/* Timeline */}
                <div className="text-sm space-y-1">
                  <p className="text-gray-400 font-medium">Timeline:</p>
                  <p>Erstellt: {formatDate(selectedRide.created_at)}</p>
                  {selectedRide.accepted_at && <p>Angenommen: {formatDate(selectedRide.accepted_at)}</p>}
                  {selectedRide.completed_at && <p>Abgeschlossen: {formatDate(selectedRide.completed_at)}</p>}
                </div>

                {/* Verification Methods */}
                <div className="text-sm space-y-1">
                  <div><span className="text-gray-400">Abholung:</span> {selectedRide.pickup_method === 'code' ? 'Code' : 'Foto'}</div>
                  <div><span className="text-gray-400">Übergabe:</span> {selectedRide.delivery_method === 'code' ? 'Code' : 'Foto'}</div>
                </div>

                {/* Photos */}
                {selectedRide.pickup_photo_url && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Abhol-Foto</p>
                    <img src={`${apiBase}${selectedRide.pickup_photo_url}`} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                  </div>
                )}
                {selectedRide.delivery_photo_url && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Ablieferungs-Foto</p>
                    <img src={`${apiBase}${selectedRide.delivery_photo_url}`} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                  </div>
                )}
              </>
            ) : (
              /* Chat Tab */
              <div className="space-y-2">
                {chatLoading ? (
                  <p className="text-center text-sm text-gray-400 py-8">Laden...</p>
                ) : chatMessages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">Keine Chat-Nachrichten für diesen Auftrag.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">{msg.sender_name}</span>
                        <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
