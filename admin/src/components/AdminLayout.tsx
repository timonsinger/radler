'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import Sidebar from './Sidebar';

export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.replace('/login'); return; }
    apiFetch('/api/admin/dashboard')
      .then((data) => setPending(data.pendingDriverApprovals))
      .catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen">
      <Sidebar pendingApprovals={pending} />
      <main className="ml-[250px] min-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-400">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
