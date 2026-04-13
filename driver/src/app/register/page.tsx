'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type VehicleType = 'bicycle' | 'cargo_bike';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [vehicleType, setVehicleType] = useState<VehicleType>('bicycle');
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
      // Fahrzeugtyp setzen
      await apiFetch('/api/drivers/vehicle-type', {
        method: 'PATCH',
        body: JSON.stringify({ vehicle_type: vehicleType }),
      });
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Registrierung');
    } finally {
      setLoading(false);
    }
  }

  const vehicles: { type: VehicleType; emoji: string; label: string; desc: string }[] = [
    { type: 'bicycle', emoji: '🚲', label: 'Fahrradkurier', desc: 'Rucksack-Größe' },
    { type: 'cargo_bike', emoji: '🚛', label: 'Lastenrad', desc: 'Größere Pakete' },
  ];

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <div className="flex flex-col items-center pt-12 pb-8 px-6">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-3">
          <span className="text-4xl">🚲</span>
        </div>
        <h1 className="text-2xl font-black text-white">Fahrer werden</h1>
        <p className="text-white/70 text-sm mt-1">Radler Kurier-Netzwerk</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-7 pb-8">
        <h2 className="text-xl font-black text-gray-900 mb-5">Konto erstellen</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { name: 'name', label: 'Name', placeholder: 'Max Mustermann', type: 'text' },
            { name: 'email', label: 'E-Mail', placeholder: 'max@email.de', type: 'email' },
            { name: 'phone', label: 'Telefon', placeholder: '+49 171 1234567', type: 'tel' },
            { name: 'password', label: 'Passwort', placeholder: 'Mindestens 6 Zeichen', type: 'password' },
          ].map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{field.label}</label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name as keyof typeof form]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.name !== 'phone'}
                className="w-full px-4 py-4 rounded-2xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          ))}

          {/* Fahrzeugtyp */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Fahrzeug</label>
            <div className="grid grid-cols-2 gap-3">
              {vehicles.map((v) => (
                <button
                  key={v.type}
                  type="button"
                  onClick={() => setVehicleType(v.type)}
                  className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all appearance-none ${
                    vehicleType === v.type
                      ? 'border-primary bg-primary-bg'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl mb-1.5">{v.emoji}</span>
                  <span className="font-bold text-sm text-gray-900">{v.label}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-error text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-black text-lg py-5 rounded-2xl mt-1 active:bg-primary/80 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Registrieren...' : 'REGISTRIEREN'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-3">
          Mit der Registrierung akzeptierst du unsere{' '}
          <Link href="/agb" className="text-primary underline">AGB</Link> und{' '}
          <Link href="/datenschutz" className="text-primary underline">Datenschutzerklärung</Link>.
        </p>

        <p className="text-center text-sm text-gray-500 mt-5">
          Bereits registriert?{' '}
          <Link href="/login" className="text-primary font-bold">Einloggen</Link>
        </p>

        <div className="flex justify-center gap-4 mt-6">
          <Link href="/impressum" className="text-xs text-gray-400 hover:text-gray-600">Impressum</Link>
          <Link href="/agb" className="text-xs text-gray-400 hover:text-gray-600">AGB</Link>
          <Link href="/datenschutz" className="text-xs text-gray-400 hover:text-gray-600">Datenschutz</Link>
        </div>
      </div>
    </div>
  );
}
