'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getImageUrl } from '../lib/api';

interface Task {
  id: string;
  name: string;
  category: string | null;
  photo_url: string | null;
  points: number;
}

interface CompleteTaskModalProps {
  tasks: Task[];
  onComplete: (taskId: string) => void;
  onClose: () => void;
}

export default function CompleteTaskModal({ tasks, onComplete, onClose }: CompleteTaskModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleConfirm() {
    if (!selected) return;
    onComplete(selected);
    setDone(true);
    setTimeout(() => onClose(), 1200);
  }

  // Gruppiert nach Kategorie
  const categories = new Map<string, Task[]>();
  tasks.forEach(t => {
    const cat = t.category || 'Sonstiges';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(t);
  });

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center">
        <div className="bg-white rounded-3xl p-10 text-center space-y-3 animate-bounce">
          <div className="text-6xl">🎉</div>
          <p className="text-lg font-heading font-bold text-gray-900">Super gemacht!</p>
          <p className="text-sm text-gray-400">+{tasks.find(t => t.id === selected)?.points || 0} Punkte</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className={`bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-y-auto p-5 modal-sheet space-y-3 ${
          tasks.length > 0 ? 'max-h-[80vh]' : ''
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-heading font-bold text-gray-900">Was hast du gemacht?</h2>
            <p className="text-xs text-gray-400 mt-0.5">Wähle die erledigte Aufgabe aus</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-3xl">📋</p>
            <p className="text-gray-400 text-sm">Noch keine Aufgaben erstellt</p>
            <button
              onClick={() => { onClose(); router.push('/tasks'); }}
              className="text-primary font-semibold text-sm"
            >
              Jetzt Aufgaben erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(categories.entries()).map(([cat, catTasks]) => (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-1.5">
                  {catTasks.map(task => {
                    const isSelected = selected === task.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelected(isSelected ? null : task.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-2 border-primary scale-[1.02]'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        {task.photo_url ? (
                          <img src={getImageUrl(task.photo_url)!} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">🧹</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                            {task.name}
                          </p>
                        </div>
                        <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                          isSelected ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
                        }`}>
                          +{task.points}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <button
            onClick={handleConfirm}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all text-sm"
          >
            Erledigt ✓
          </button>
        )}
      </div>
    </div>
  );
}
