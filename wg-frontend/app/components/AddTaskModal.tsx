'use client';

import { useState, useRef } from 'react';
import { apiFetch } from '../lib/api';

interface AddTaskModalProps {
  wgId: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddTaskModal({ wgId, onClose, onAdded }: AddTaskModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = ['Bad', 'Küche', 'Wohnzimmer', 'Flur', 'Müll', 'Wäsche', 'Sonstiges'];

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      if (category) formData.append('category', category);
      if (description) formData.append('description', description);
      formData.append('points', points.toString());
      if (fileRef.current?.files?.[0]) formData.append('photo', fileRef.current.files[0]);

      await apiFetch(`/api/wg/${wgId}/tasks`, { method: 'POST', body: formData });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-gray-900">Neue Aufgabe</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              placeholder="z.B. Bad putzen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    category === c
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition resize-none"
              placeholder="Optional..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Punkte</label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5, 10].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPoints(p)}
                  className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                    points === p
                      ? 'bg-accent text-white scale-110'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Foto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary transition flex items-center justify-center overflow-hidden"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">📷 Foto hinzufügen</span>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? 'Wird erstellt...' : 'Aufgabe erstellen'}
          </button>
        </form>
      </div>
    </div>
  );
}
