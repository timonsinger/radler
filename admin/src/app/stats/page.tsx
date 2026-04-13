'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiFetch } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import AdminLayout from '@/components/AdminLayout';

interface DayStats {
  date: string;
  rides: number;
  revenue: number;
  platformFees: number;
  newUsers: number;
  newDrivers: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<DayStats[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/stats/daily?days=30').then((data) => {
      setStats(data.stats);
    }).catch(console.error);
  }, []);

  const formatted = stats.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <AdminLayout title="Statistiken">
      {/* Rides per day */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Fahrten pro Tag (30 Tage)</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, 'Fahrten']} />
              <Bar dataKey="rides" fill="#14532D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue per day */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz pro Tag (30 Tage)</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(2).replace('.', ',')} €`, name === 'revenue' ? 'Umsatz' : 'Provision']} />
              <Legend formatter={(v) => (v === 'revenue' ? 'Umsatz' : 'Provision')} />
              <Line type="monotone" dataKey="revenue" stroke="#14532D" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="platformFees" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* New registrations per day */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Neue Registrierungen pro Tag (30 Tage)</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip />
              <Legend formatter={(v) => (v === 'newUsers' ? 'Kunden' : 'Fahrer')} />
              <Bar dataKey="newUsers" fill="#3B82F6" stackId="a" radius={[0, 0, 0, 0]} name="newUsers" />
              <Bar dataKey="newDrivers" fill="#22C55E" stackId="a" radius={[4, 4, 0, 0]} name="newDrivers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Tagesübersicht</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Datum</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fahrten</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Umsatz</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Provision</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Neue Nutzer</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Neue Fahrer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...stats].reverse().map((d) => (
              <tr key={d.date} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                  {new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-right font-medium">{d.rides}</td>
                <td className="px-4 py-3 text-right">{formatPrice(d.revenue)}</td>
                <td className="px-4 py-3 text-right text-green-700">{formatPrice(d.platformFees)}</td>
                <td className="px-4 py-3 text-right">{d.newUsers}</td>
                <td className="px-4 py-3 text-right">{d.newDrivers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
