'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, logout } from '@/lib/auth';
import NavBar from '@/components/NavBar';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }
    setUser(stored);
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Avatar + Name */}
        <div className="bg-white rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-3">
            <span className="text-primary-fg text-3xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
          {user.phone && (
            <p className="text-gray-500 text-sm">{user.phone}</p>
          )}
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Konto</h3>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-500 text-sm">Name</span>
            <span className="text-gray-900 text-sm font-medium">{user.name}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-500 text-sm">E-Mail</span>
            <span className="text-gray-900 text-sm font-medium">{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500 text-sm">Telefon</span>
              <span className="text-gray-900 text-sm font-medium">{user.phone}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500 text-sm">Rolle</span>
            <span className="text-gray-900 text-sm font-medium capitalize">{user.role}</span>
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
