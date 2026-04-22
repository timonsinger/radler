'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch, getImageUrl } from '../lib/api';
import BottomNav from '../components/BottomNav';
import Avatar from '../components/Avatar';

interface Member {
  id: string;
  name: string;
  email: string;
  profile_image_url: string | null;
  joined_at: string;
}

export default function ProfilePage() {
  const { user, wg, loading: authLoading, logout, refresh } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!wg) { router.replace('/wg'); return; }

    // Load WG members
    apiFetch<{ wg: unknown; members: Member[] }>(`/api/wg/${wg.wg_id}`)
      .then(data => setMembers(data.members))
      .catch(console.error);

    setEditName(user.name);
  }, [user, wg, authLoading, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const formData = new FormData();
      if (editName && editName !== user?.name) formData.append('name', editName);
      if (fileRef.current?.files?.[0]) formData.append('profile_image', fileRef.current.files[0]);

      if ([...formData.entries()].length === 0) {
        setEditing(false);
        setSaving(false);
        return;
      }

      await apiFetch('/api/auth/profile', { method: 'PATCH', body: formData });
      await refresh();
      setEditing(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveWg() {
    if (!wg || !confirm('Willst du die WG wirklich verlassen?')) return;
    setLeaving(true);
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/leave`, { method: 'DELETE' });
      await refresh();
      router.replace('/wg');
    } catch (err) {
      console.error('Leave error:', err);
    } finally {
      setLeaving(false);
    }
  }

  if (authLoading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">👤</div></div>;
  }

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
        <h1 className="text-2xl font-heading font-bold text-gray-900">Profil</h1>

        {/* User Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => editing && fileRef.current?.click()}
              className={`relative ${editing ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <Avatar src={user.profile_image_url} name={user.name} size="lg" />
              {editing && (
                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">📷</span>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" />
            <div className="flex-1">
              {editing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary outline-none text-sm font-semibold"
                />
              ) : (
                <p className="font-semibold text-gray-900">{user.name}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
            </div>
          </div>

          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-primary-light transition disabled:opacity-60"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditName(user.name); }}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition"
            >
              Profil bearbeiten
            </button>
          )}
        </div>

        {/* WG Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-gray-900">{wg.wg_name}</h2>
            <span className="text-xs text-gray-400 font-mono">{wg.invite_code}</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Mitglieder ({members.length})</p>
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3 py-1.5">
                <Avatar src={member.profile_image_url} name={member.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.name} {member.id === user.id && <span className="text-gray-400">(Du)</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleLeaveWg}
            disabled={leaving}
            className="w-full py-3 rounded-xl text-sm font-semibold text-danger bg-danger/5 hover:bg-danger/10 transition disabled:opacity-60"
          >
            {leaving ? 'Verlasse WG...' : 'WG verlassen'}
          </button>
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="w-full py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
          >
            Abmelden
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
