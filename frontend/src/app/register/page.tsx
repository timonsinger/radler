'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Registrierung');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8">
      <div className="mb-8">
        <span className="inline-block bg-radler-ink-800 text-white font-heading font-bold text-lg tracking-[1.5px] px-4 py-2 rounded-[10px] mb-4">
          RADLER
        </span>
        <h1 className="font-heading text-2xl font-bold text-radler-ink-800">Konto erstellen</h1>
        <p className="font-body text-radler-ink-400 text-sm">Kurier-Service in Konstanz</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full mx-auto">
        {[
          { name: 'name', label: 'Name', placeholder: 'Max Mustermann', type: 'text' },
          { name: 'email', label: 'E-Mail', placeholder: 'max@email.de', type: 'email' },
          { name: 'phone', label: 'Telefon (optional)', placeholder: '+49 171 1234567', type: 'tel' },
          { name: 'password', label: 'Passwort', placeholder: 'Mindestens 6 Zeichen', type: 'password' },
        ].map((field) => (
          <div key={field.name}>
            <label className="block font-body text-sm font-medium text-radler-ink-700 mb-1.5">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              value={form[field.name as keyof typeof form]}
              onChange={handleChange}
              placeholder={field.placeholder}
              required={field.name !== 'phone'}
              className="w-full font-body px-4 py-3.5 rounded-[12px] border border-radler-ink-200 text-sm text-radler-ink-800 focus:outline-none focus:ring-2 focus:ring-radler-green-500/30 focus:border-radler-green-500"
            />
          </div>
        ))}

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
          {loading ? 'Registrieren...' : 'Registrieren'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">
          Mit der Registrierung akzeptierst du unsere{' '}
          <Link href="/agb" className="text-radler-green-500 underline">AGB</Link> und{' '}
          <Link href="/datenschutz" className="text-radler-green-500 underline">Datenschutzerklärung</Link>.
        </p>

        <p className="text-center text-sm text-gray-500 mt-2">
          Bereits registriert?{' '}
          <Link href="/login" className="text-radler-green-500 font-semibold">
            Einloggen
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
