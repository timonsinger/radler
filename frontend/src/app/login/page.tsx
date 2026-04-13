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
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16 pb-8">
      {/* Logo */}
      <div className="flex flex-col items-center mb-12">
        <img src="/radler_logo.svg" alt="Radler" className="h-16 w-auto mb-2" />
        <p className="text-gray-500 mt-1 text-sm">Kurier-Service in Konstanz</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full mx-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
          className="w-full bg-primary text-primary-fg font-semibold py-4 rounded-2xl mt-2 active:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {loading ? 'Einloggen...' : 'Einloggen'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-2">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-primary font-semibold">
            Registrieren
          </Link>
        </p>
      </form>

      <div className="flex justify-center gap-4 mt-8">
        <Link href="/impressum" className="text-xs text-gray-400 hover:text-gray-600">Impressum</Link>
        <Link href="/datenschutz" className="text-xs text-gray-400 hover:text-gray-600">Datenschutz</Link>
      </div>
    </div>
  );
}
