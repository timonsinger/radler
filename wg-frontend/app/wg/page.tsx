'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';

export default function WgPage() {
  const { user, refresh, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/wg', { method: 'POST', body: JSON.stringify({ name }) });
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/wg/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) });
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">🏠</div></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🏠</div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Hallo, {user.name}!</h1>
          <p className="text-gray-400 text-sm mt-1">Erstelle eine WG oder tritt einer bei</p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all"
            >
              WG erstellen
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-accent text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-accent-light active:scale-[0.98] transition-all"
            >
              WG beitreten
            </button>
            <button
              onClick={logout}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition"
            >
              Abmelden
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WG-Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                placeholder="z.B. WG Konstanz"
              />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-60">
              {loading ? 'Wird erstellt...' : 'WG erstellen'}
            </button>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
              Zurück
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Einladungscode</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                required
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-center text-lg font-mono tracking-widest uppercase"
                placeholder="ABCD1234"
              />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-accent text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-accent-light active:scale-[0.98] transition-all disabled:opacity-60">
              {loading ? 'Trete bei...' : 'Beitreten'}
            </button>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
              Zurück
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
