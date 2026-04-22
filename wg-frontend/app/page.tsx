'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function Home() {
  const [pingResult, setPingResult] = useState<{ message: string; timestamp: string; total_pings: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Service Worker registrieren
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  async function handlePing() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/ping`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPingResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center space-y-6">
        {/* Logo / Emoji */}
        <div className="text-6xl">🧹</div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-gray-900">
            WG-App läuft
          </h1>
          <p className="text-gray-400 mt-2">
            Scaffold-Test — Features kommen später
          </p>
        </div>

        {/* Ping Button */}
        <button
          onClick={handlePing}
          disabled={loading}
          className="w-full bg-primary text-white font-semibold py-4 rounded-2xl shadow-md hover:bg-primary-light active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? 'Pinging...' : 'Ping Backend'}
        </button>

        {/* Response */}
        {pingResult && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-primary">Verbunden</span>
            </div>
            <div className="text-sm text-gray-600">
              <p><span className="text-gray-400">Response:</span> {pingResult.message}</p>
              <p><span className="text-gray-400">Timestamp:</span> {new Date(pingResult.timestamp).toLocaleString('de-DE')}</p>
              <p><span className="text-gray-400">Total Pings:</span> <span className="font-bold text-accent">{pingResult.total_pings}</span></p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Socket.io Status */}
        <p className="text-xs text-gray-300">
          Socket.io + PWA ready
        </p>
      </div>
    </div>
  );
}
