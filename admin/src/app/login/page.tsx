'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-primary">Radler</h1>
          <p className="text-gray-500 text-sm mt-1">Admin-Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
