'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      if (fileRef.current?.files?.[0]) {
        formData.append('profile_image', fileRef.current.files[0]);
      }
      await register(formData);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-gray-900">Konto erstellen</h1>
          <p className="text-gray-400 text-sm mt-1">Erstelle dein Profil</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profilbild */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-primary transition overflow-hidden flex items-center justify-center"
            >
              {preview ? (
                <img src={preview} alt="Vorschau" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-gray-400">📷</span>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              placeholder="Dein Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              placeholder="deine@email.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              placeholder="Mind. 6 Zeichen"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? 'Wird erstellt...' : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Bereits ein Konto?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
