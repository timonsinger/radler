'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, logout } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import NavBar from '@/components/NavBar';

interface ProfileData {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  profile_image_url?: string;
  stats?: { total_bookings: number };
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }

    apiFetch('/api/auth/me').then((data) => {
      setUser(data);
      setName(data.name || '');
      setPhone(data.phone || '');
    }).catch(() => router.replace('/login'));
  }, [router]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('profile_image', file);

    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const res = await fetch(`${apiUrl}/api/auth/profile`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.user) {
        setUser((prev) => prev ? { ...prev, profile_image_url: data.user.profile_image_url } : prev);
      }
    } catch (err) {
      console.error('Foto-Upload fehlgeschlagen:', err);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const data = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      if (data.user) {
        setUser((prev) => prev ? { ...prev, ...data.user } : prev);
        // localStorage aktualisieren
        const stored = getStoredUser();
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...stored, name: data.user.name, phone: data.user.phone }));
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Speichern fehlgeschlagen:', err);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const imageUrl = photoPreview || (user.profile_image_url ? `${apiBase}${user.profile_image_url}` : null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Avatar + Foto ändern */}
        <div className="bg-white rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className="relative mb-3">
            {imageUrl ? (
              <img src={imageUrl} alt="Profil" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-fg text-4xl font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>

        {/* Formular */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Persönliche Daten</h3>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">E-Mail</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-100 text-sm text-gray-400 bg-gray-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">Telefon</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full font-semibold py-4 rounded-2xl transition-colors ${
              saved ? 'bg-green-500 text-white' : 'bg-primary text-primary-fg active:bg-primary-dark'
            } disabled:opacity-60`}
          >
            {saving ? 'Speichern...' : saved ? 'Gespeichert!' : 'Speichern'}
          </button>
        </div>

        {/* Statistiken */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Meine Statistiken</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">{user.stats?.total_bookings ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">Buchungen</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-900">
                {user.role === 'customer' ? 'Kunde' : 'Fahrer'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Rolle</p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full bg-red-50 text-red-600 font-semibold py-4 rounded-3xl flex items-center justify-center gap-2 active:bg-red-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Abmelden
        </button>
      </div>

      <NavBar />
    </div>
  );
}
