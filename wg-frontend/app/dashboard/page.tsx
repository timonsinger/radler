'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import BottomNav from '../components/BottomNav';
import RankingList from '../components/RankingList';
import CompleteTaskModal from '../components/CompleteTaskModal';
import InviteCodeCard from '../components/InviteCodeCard';
import { getImageUrl } from '../lib/api';

interface Task {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  photo_url: string | null;
  points: number;
  is_due: boolean;
  created_by: string;
  creator_name: string;
  creator_image: string | null;
  completion_count: string;
  completions: Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_image: string | null;
    completed_at: string;
  }> | null;
  created_at: string;
}

interface RankingEntry {
  id: string;
  name: string;
  profile_image_url: string | null;
  total_points: number;
  tasks_completed: number;
}

const categoryColors: Record<string, string> = {
  Bad: 'bg-blue-100 text-blue-700',
  Küche: 'bg-orange-100 text-orange-700',
  Wohnzimmer: 'bg-green-100 text-green-700',
  Flur: 'bg-yellow-100 text-yellow-700',
  Müll: 'bg-gray-200 text-gray-700',
  Wäsche: 'bg-pink-100 text-pink-700',
  Sonstiges: 'bg-purple-100 text-purple-700',
};

export default function DashboardPage() {
  const { user, wg, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [tab, setTab] = useState<'home' | 'ranking'>('home');

  const loadData = useCallback(async () => {
    if (!wg) return;
    try {
      const [tasksData, rankingData] = await Promise.all([
        apiFetch<{ tasks: Task[] }>(`/api/wg/${wg.wg_id}/tasks`),
        apiFetch<{ ranking: RankingEntry[] }>(`/api/wg/${wg.wg_id}/tasks/ranking`),
      ]);
      setTasks(tasksData.tasks);
      setRanking(rankingData.ranking);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }, [wg]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!wg) { router.replace('/wg'); return; }
    loadData();
  }, [user, wg, authLoading, router, loadData]);

  // Socket.io listeners
  useEffect(() => {
    if (!wg) return;
    const socket = getSocket();

    socket.on('task:created', () => loadData());
    socket.on('task:completed', () => loadData());
    socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    });
    socket.on('task:updated', () => loadData());

    return () => {
      socket.off('task:created');
      socket.off('task:completed');
      socket.off('task:deleted');
      socket.off('task:updated');
    };
  }, [wg, loadData]);

  async function handleComplete(taskId: string) {
    if (!wg) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/tasks/${taskId}/complete`, { method: 'POST' });
      loadData();
    } catch (err) {
      console.error('Complete error:', err);
    }
  }

  if (authLoading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">🧹</div></div>;
  }

  const dueTasks = tasks.filter(t => t.is_due);

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-heading font-bold text-gray-900 break-words">{wg.wg_name}</h1>
          <p className="text-xs text-gray-400">Willkommen, {user.name}</p>
        </div>

        {/* Großer "Ich habe was gemacht" Button */}
        <button
          onClick={() => setShowCompleteModal(true)}
          className="w-full bg-primary text-white rounded-2xl p-4 shadow-lg hover:bg-primary-light active:scale-[0.98] transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
              ✨
            </div>
            <div>
              <p className="font-heading font-bold">Ich habe was gemacht!</p>
              <p className="text-white/70 text-xs mt-0.5">Aufgabe auswählen & Punkte kassieren</p>
            </div>
          </div>
        </button>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('home')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'home' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Anfällig
          </button>
          <button
            onClick={() => setTab('ranking')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'ranking' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Ranking 🏆
          </button>
        </div>

        {/* Content */}
        {tab === 'home' ? (
          <div className="space-y-3">
            {dueTasks.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <p className="text-4xl">✅</p>
                <p className="text-gray-900 font-heading font-semibold">Alles sauber!</p>
                <p className="text-gray-400 text-sm">Keine Aufgaben stehen an</p>
                <p className="text-gray-300 text-xs mt-2">
                  Markiere Aufgaben als anfällig im{' '}
                  <button onClick={() => router.push('/tasks')} className="text-primary font-semibold">
                    Aufgaben-Tab
                  </button>
                </p>
              </div>
            ) : (
              dueTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl shadow-sm border border-orange-100 p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    {task.photo_url ? (
                      <img src={getImageUrl(task.photo_url)!} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">⚠️</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-bold text-gray-900 truncate">{task.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.category && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColors[task.category] || 'bg-gray-100 text-gray-600'}`}>
                            {task.category}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {task.completion_count}x erledigt
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 bg-accent/10 text-accent px-2.5 py-1 rounded-full flex-shrink-0">
                      <span className="text-xs font-bold">{task.points}</span>
                      <span className="text-[10px]">Pkt</span>
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-400 line-clamp-1 pl-15">{task.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <RankingList ranking={ranking} currentUserId={user.id} />
        )}

        {/* Invite Code (unten) */}
        <InviteCodeCard code={wg.invite_code} wgName={wg.wg_name} />
      </main>

      {showCompleteModal && (
        <CompleteTaskModal
          tasks={tasks}
          onComplete={handleComplete}
          onClose={() => setShowCompleteModal(false)}
        />
      )}

      <BottomNav />
    </>
  );
}
