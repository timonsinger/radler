'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Einloggen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header grün */}
      <div className="flex flex-col items-center pt-16 pb-10 px-6">
        <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-4">
          <span className="text-5xl">🚲</span>
        </div>
        <h1 className="text-3xl font-black text-white">Radler</h1>
        <p className="text-white/70 text-sm mt-1">Fahrer-App</p>
      </div>

      {/* Weißes Panel */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-8">
        <h2 className="text-2xl font-black text-gray-900 mb-6">Einloggen</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.de"
              required
              className="w-full px-4 py-4 rounded-2xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-4 rounded-2xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-error text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-black text-lg py-5 rounded-2xl mt-2 active:bg-primary/80 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Einloggen...' : 'EINLOGGEN'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Noch kein Fahrer-Account?{' '}
          <Link href="/register" className="text-primary font-bold">
            Registrieren
          </Link>
        </p>

        <div className="flex justify-center gap-4 mt-6">
          <Link href="/impressum" className="text-xs text-gray-400 hover:text-gray-600">Impressum</Link>
          <Link href="/datenschutz" className="text-xs text-gray-400 hover:text-gray-600">Datenschutz</Link>
        </div>
      </div>
    </div>
  );
}
