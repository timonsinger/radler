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
        <img src="/radler_logo.svg" alt="Radler" className="h-12 w-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Konto erstellen</h1>
        <p className="text-gray-500 text-sm">Kurier-Service in Konstanz</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full mx-auto">
        {[
          { name: 'name', label: 'Name', placeholder: 'Max Mustermann', type: 'text' },
          { name: 'email', label: 'E-Mail', placeholder: 'max@email.de', type: 'email' },
          { name: 'phone', label: 'Telefon (optional)', placeholder: '+49 171 1234567', type: 'tel' },
          { name: 'password', label: 'Passwort', placeholder: 'Mindestens 6 Zeichen', type: 'password' },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              value={form[field.name as keyof typeof form]}
              onChange={handleChange}
              placeholder={field.placeholder}
              required={field.name !== 'phone'}
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
          className="w-full bg-primary text-primary-fg font-semibold py-4 rounded-2xl mt-2 active:bg-primary-dark disabled:opacity-60 transition-colors"
        >
          {loading ? 'Registrieren...' : 'Registrieren'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-2">
          Bereits registriert?{' '}
          <Link href="/login" className="text-primary font-semibold">
            Einloggen
          </Link>
        </p>
      </form>
    </div>
  );
}
