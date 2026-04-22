'use client';

import Avatar from './Avatar';
import { getImageUrl } from '../lib/api';

interface Completion {
  id: string;
  user_id: string;
  user_name: string;
  user_image: string | null;
  completed_at: string;
}

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
  completions: Completion[] | null;
  created_at: string;
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  currentUserId: string;
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

export default function TaskCard({ task, onComplete, onDelete, currentUserId }: TaskCardProps) {
  const photoUrl = getImageUrl(task.photo_url);
  const isCreator = task.created_by === currentUserId;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {photoUrl && (
        <div className="h-32 overflow-hidden">
          <img src={photoUrl} alt={task.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-gray-900 truncate">{task.name}</h3>
            {task.category && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryColors[task.category] || 'bg-gray-100 text-gray-600'}`}>
                {task.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-accent/10 text-accent px-2.5 py-1 rounded-full flex-shrink-0">
            <span className="text-xs font-bold">{task.points}</span>
            <span className="text-[10px]">Pkt</span>
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
        )}

        {/* Completions */}
        {task.completions && task.completions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {task.completions.slice(0, 5).map(c => (
                <Avatar key={c.id} src={c.user_image} name={c.user_name} size="sm" />
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-1">
              {task.completion_count}x erledigt
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onComplete(task.id)}
            className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-primary-light active:scale-[0.98] transition-all"
          >
            Erledigt ✓
          </button>
          {isCreator && onDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="px-3 py-2.5 rounded-xl text-sm text-danger bg-danger/5 hover:bg-danger/10 transition"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
