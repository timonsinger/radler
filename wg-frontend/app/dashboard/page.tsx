'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import BottomNav from '../components/BottomNav';
import TaskCard from '../components/TaskCard';
import RankingList from '../components/RankingList';
import AddTaskModal from '../components/AddTaskModal';
import InviteCodeCard from '../components/InviteCodeCard';

interface Task {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  photo_url: string | null;
  points: number;
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

export default function DashboardPage() {
  const { user, wg, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'tasks' | 'ranking'>('tasks');

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

    socket.on('task:created', ({ task }: { task: Task }) => {
      setTasks(prev => [task, ...prev]);
    });
    socket.on('task:completed', () => {
      loadData(); // Refresh to get updated completions + ranking
    });
    socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    });

    return () => {
      socket.off('task:created');
      socket.off('task:completed');
      socket.off('task:deleted');
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

  async function handleDelete(taskId: string) {
    if (!wg || !confirm('Task wirklich löschen?')) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  if (authLoading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">🧹</div></div>;
  }

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">{wg.wg_name}</h1>
            <p className="text-xs text-gray-400">Willkommen, {user.name}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-12 h-12 bg-primary text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-primary-light active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {/* Invite Code */}
        <InviteCodeCard code={wg.invite_code} wgName={wg.wg_name} />

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('tasks')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Aufgaben
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
        {tab === 'tasks' ? (
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-4xl">📋</p>
                <p className="text-gray-400 text-sm">Noch keine Aufgaben</p>
                <button onClick={() => setShowModal(true)} className="text-primary font-semibold text-sm">
                  Erste Aufgabe erstellen
                </button>
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  currentUserId={user.id}
                />
              ))
            )}
          </div>
        ) : (
          <RankingList ranking={ranking} currentUserId={user.id} />
        )}
      </main>

      {showModal && (
        <AddTaskModal
          wgId={wg.wg_id}
          onClose={() => setShowModal(false)}
          onAdded={loadData}
        />
      )}

      <BottomNav />
    </>
  );
}
