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
        <span className="inline-block bg-radler-ink-800 text-white font-heading font-bold text-2xl tracking-[1.5px] px-5 py-2.5 rounded-[10px] mb-3">
          RADLER
        </span>
        <p className="font-body text-radler-ink-400 text-sm">Kurier-Service in Konstanz</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full mx-auto">
        <div>
          <label className="block font-body text-sm font-medium text-radler-ink-700 mb-1.5">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            className="w-full font-body px-4 py-3.5 rounded-[12px] border border-radler-ink-200 text-sm text-radler-ink-800 focus:outline-none focus:ring-2 focus:ring-radler-green-500/30 focus:border-radler-green-500"
          />
        </div>

        <div>
          <label className="block font-body text-sm font-medium text-radler-ink-700 mb-1.5">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full font-body px-4 py-3.5 rounded-[12px] border border-radler-ink-200 text-sm text-radler-ink-800 focus:outline-none focus:ring-2 focus:ring-radler-green-500/30 focus:border-radler-green-500"
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
          className="w-full bg-radler-green-500 text-white font-body font-semibold py-4 rounded-[12px] mt-2 active:bg-radler-green-600 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Einloggen...' : 'Einloggen'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-2">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-radler-green-500 font-semibold">
            Registrieren
          </Link>
        </p>
      </form>

      <div className="flex justify-center gap-4 mt-8">
        <Link href="/impressum" className="text-xs text-gray-400 hover:text-gray-600">Impressum</Link>
        <Link href="/agb" className="text-xs text-gray-400 hover:text-gray-600">AGB</Link>
        <Link href="/datenschutz" className="text-xs text-gray-400 hover:text-gray-600">Datenschutz</Link>
      </div>
    </div>
  );
}
