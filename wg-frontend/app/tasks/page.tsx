'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch, getImageUrl } from '../lib/api';
import { getSocket } from '../lib/socket';
import BottomNav from '../components/BottomNav';
import AddTaskModal from '../components/AddTaskModal';

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
  completion_count: string;
  created_at: string;
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

export default function TasksPage() {
  const { user, wg, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!wg) return;
    try {
      const data = await apiFetch<{ tasks: Task[] }>(`/api/wg/${wg.wg_id}/tasks`);
      setTasks(data.tasks);
    } catch (err) {
      console.error('Tasks load error:', err);
    }
  }, [wg]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!wg) { router.replace('/wg'); return; }
    loadTasks();
  }, [user, wg, authLoading, router, loadTasks]);

  // Socket.io
  useEffect(() => {
    if (!wg) return;
    const socket = getSocket();
    socket.on('task:created', () => loadTasks());
    socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    });
    socket.on('task:updated', () => loadTasks());
    return () => {
      socket.off('task:created');
      socket.off('task:deleted');
      socket.off('task:updated');
    };
  }, [wg, loadTasks]);

  async function handleToggleDue(taskId: string) {
    if (!wg) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/tasks/${taskId}/due`, { method: 'PATCH' });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_due: !t.is_due } : t));
    } catch (err) {
      console.error('Toggle due error:', err);
    }
  }

  async function handleDelete(taskId: string) {
    if (!wg || !confirm('Aufgabe wirklich löschen?')) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  if (authLoading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">📋</div></div>;
  }

  // Gruppieren: Anfällig oben, Rest unten
  const dueTasks = tasks.filter(t => t.is_due);
  const notDueTasks = tasks.filter(t => !t.is_due);

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Aufgaben</h1>
            <p className="text-xs text-gray-400">{tasks.length} Aufgaben erstellt</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-12 h-12 bg-primary text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-primary-light active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {/* Info */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-center gap-2">
          <span className="text-lg">💡</span>
          <p className="text-xs text-orange-700">
            Tippe auf <strong>Steht an</strong>, damit eine Aufgabe auf dem Homescreen erscheint.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">📋</p>
            <p className="text-gray-400 text-sm">Noch keine Aufgaben</p>
            <button onClick={() => setShowAddModal(true)} className="text-primary font-semibold text-sm">
              Erste Aufgabe erstellen
            </button>
          </div>
        ) : (
          <>
            {/* Anfällige Tasks */}
            {dueTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">
                  ⚠️ Steht an ({dueTasks.length})
                </p>
                {dueTasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    currentUserId={user.id}
                    onToggleDue={handleToggleDue}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Alle Tasks */}
            {notDueTasks.length > 0 && (
              <div className="space-y-2">
                {dueTasks.length > 0 && (
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-4">
                    Alle Aufgaben ({notDueTasks.length})
                  </p>
                )}
                {notDueTasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    currentUserId={user.id}
                    onToggleDue={handleToggleDue}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showAddModal && (
        <AddTaskModal
          wgId={wg.wg_id}
          onClose={() => setShowAddModal(false)}
          onAdded={loadTasks}
        />
      )}

      <BottomNav />
    </>
  );
}

// --- Task-Liste Item ---

interface TaskListItemProps {
  task: Task;
  currentUserId: string;
  onToggleDue: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

function TaskListItem({ task, currentUserId, onToggleDue, onDelete }: TaskListItemProps) {
  const isCreator = task.created_by === currentUserId;

  return (
    <div className={`bg-white rounded-xl border p-3 flex items-center gap-3 transition-all ${
      task.is_due ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
    }`}>
      {/* Foto oder Icon */}
      {task.photo_url ? (
        <img src={getImageUrl(task.photo_url)!} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
          task.is_due ? 'bg-orange-100' : 'bg-gray-100'
        }`}>
          <span className="text-lg">🧹</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.category && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${categoryColors[task.category] || 'bg-gray-100 text-gray-600'}`}>
              {task.category}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{task.points} Pkt</span>
          <span className="text-[10px] text-gray-300">{task.completion_count}x</span>
        </div>
      </div>

      {/* Anfällig-Toggle */}
      <button
        onClick={() => onToggleDue(task.id)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
          task.is_due
            ? 'bg-orange-500 text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600'
        }`}
      >
        {task.is_due ? '⚠️ Steht an' : 'Steht an'}
      </button>

      {/* Löschen */}
      {isCreator && (
        <button
          onClick={() => onDelete(task.id)}
          className="text-gray-300 hover:text-danger transition text-sm px-1"
        >
          🗑
        </button>
      )}
    </div>
  );
}
