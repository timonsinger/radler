'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDate, roleLabel, roleColor } from '@/lib/utils';
import AdminLayout from '@/components/AdminLayout';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
  is_banned: boolean;
  rides_count: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [banLoading, setBanLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (role !== 'all') params.set('role', role);
    if (search) params.set('search', search);

    apiFetch(`/api/admin/users?${params}`)
      .then((data) => {
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(Math.ceil(data.total / 50));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, role, search]);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (user: UserRow) => {
    const newBanned = !user.is_banned;
    let reason = '';
    if (newBanned) {
      reason = prompt('Grund für die Sperrung:') || '';
      if (!reason) return;
    }
    setBanLoading(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}/ban`, {
        method: 'PATCH',
        body: JSON.stringify({ banned: newBanned, reason }),
      });
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setBanLoading(null);
    }
  };

  return (
    <AdminLayout title="Nutzer">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rolle</label>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Alle</option>
            <option value="customer">Kunden</option>
            <option value="driver">Fahrer</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Suche</label>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name oder Email..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">{total} Nutzer gefunden</p>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rolle</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Registriert</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Fahrten</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleColor(u.role)}`}>{roleLabel(u.role)}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">{u.rides_count}</td>
                <td className="px-4 py-3 text-center">
                  {u.is_banned ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Gesperrt</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Aktiv</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => toggleBan(u)}
                      disabled={banLoading === u.id}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                        u.is_banned
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      } disabled:opacity-50`}
                    >
                      {banLoading === u.id ? '...' : u.is_banned ? 'Entsperren' : 'Sperren'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Keine Nutzer gefunden</td></tr>
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
    </AdminLayout>
  );
}
