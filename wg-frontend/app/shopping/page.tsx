'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import BottomNav from '../components/BottomNav';

interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  added_by: string;
  added_by_name: string;
  checked_by: string | null;
  checked_by_name: string | null;
  created_at: string;
}

export default function ShoppingPage() {
  const { user, wg, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);

  const loadItems = useCallback(async () => {
    if (!wg) return;
    try {
      const data = await apiFetch<{ items: ShoppingItem[] }>(`/api/wg/${wg.wg_id}/shopping`);
      setItems(data.items);
    } catch (err) {
      console.error('Shopping load error:', err);
    }
  }, [wg]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (!wg) { router.replace('/wg'); return; }
    loadItems();
  }, [user, wg, authLoading, router, loadItems]);

  // Socket.io
  useEffect(() => {
    if (!wg) return;
    const socket = getSocket();

    socket.on('shopping:added', ({ item }: { item: ShoppingItem }) => {
      setItems(prev => [item, ...prev]);
    });
    socket.on('shopping:toggled', ({ item }: { item: ShoppingItem }) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked, checked_by: item.checked_by } : i));
    });
    socket.on('shopping:deleted', ({ itemId }: { itemId: string }) => {
      setItems(prev => prev.filter(i => i.id !== itemId));
    });

    return () => {
      socket.off('shopping:added');
      socket.off('shopping:toggled');
      socket.off('shopping:deleted');
    };
  }, [wg]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!wg || !newItem.trim()) return;
    setAdding(true);
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/shopping`, {
        method: 'POST',
        body: JSON.stringify({ name: newItem.trim() }),
      });
      setNewItem('');
      loadItems();
    } catch (err) {
      console.error('Add error:', err);
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(itemId: string) {
    if (!wg) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/shopping/${itemId}`, { method: 'PATCH' });
      loadItems();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  }

  async function handleDelete(itemId: string) {
    if (!wg) return;
    try {
      await apiFetch(`/api/wg/${wg.wg_id}/shopping/${itemId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  if (authLoading || !user || !wg) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">🛒</div></div>;
  }

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  return (
    <>
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
        <h1 className="text-2xl font-heading font-bold text-gray-900">Einkaufsliste</h1>

        {/* Add Item */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Was wird gebraucht?"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
          />
          <button
            type="submit"
            disabled={adding || !newItem.trim()}
            className="px-5 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-light active:scale-95 transition-all disabled:opacity-60"
          >
            +
          </button>
        </form>

        {/* Unchecked Items */}
        {unchecked.length > 0 && (
          <div className="space-y-2">
            {unchecked.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                <button
                  onClick={() => handleToggle(item.id)}
                  className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-primary transition flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">von {item.added_by_name}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-300 hover:text-danger transition text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Checked Items */}
        {checked.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Erledigt</p>
            {checked.map(item => (
              <div key={item.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-3 opacity-60">
                <button
                  onClick={() => handleToggle(item.id)}
                  className="w-6 h-6 rounded-full bg-primary/20 border-2 border-primary flex-shrink-0 flex items-center justify-center"
                >
                  <span className="text-primary text-xs">✓</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 line-through truncate">{item.name}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-300 hover:text-danger transition text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">🛒</p>
            <p className="text-gray-400 text-sm">Die Einkaufsliste ist leer</p>
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
