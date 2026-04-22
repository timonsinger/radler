'use client';

import Avatar from './Avatar';

interface RankingEntry {
  id: string;
  name: string;
  profile_image_url: string | null;
  total_points: number;
  tasks_completed: number;
}

interface RankingListProps {
  ranking: RankingEntry[];
  currentUserId: string;
}

const medals = ['🥇', '🥈', '🥉'];

export default function RankingList({ ranking, currentUserId }: RankingListProps) {
  if (ranking.length === 0) {
    return <p className="text-center text-gray-400 text-sm py-4">Noch keine Punkte</p>;
  }

  return (
    <div className="space-y-2">
      {ranking.map((entry, i) => {
        const isMe = entry.id === currentUserId;
        return (
          <div
            key={entry.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition ${
              isMe ? 'bg-primary/5 border border-primary/20' : 'bg-white'
            }`}
          >
            <span className="text-xl w-8 text-center">{medals[i] || `${i + 1}.`}</span>
            <Avatar src={entry.profile_image_url} name={entry.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : 'text-gray-900'}`}>
                {entry.name} {isMe && '(Du)'}
              </p>
              <p className="text-xs text-gray-400">{entry.tasks_completed} Tasks</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-accent">{entry.total_points}</p>
              <p className="text-[10px] text-gray-400">Punkte</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
