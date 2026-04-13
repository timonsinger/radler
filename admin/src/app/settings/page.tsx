'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';

interface Settings {
  bicycle_base_fee: string;
  bicycle_per_km: string;
  bicycle_min_price: string;
  cargo_base_fee: string;
  cargo_per_km: string;
  cargo_min_price: string;
  platform_commission: string;
  ride_timeout_minutes: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    bicycle_base_fee: '4.00',
    bicycle_per_km: '1.50',
    bicycle_min_price: '5.50',
    cargo_base_fee: '6.00',
    cargo_per_km: '2.00',
    cargo_min_price: '8.00',
    platform_commission: '0.15',
    ride_timeout_minutes: '10',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/settings').then((data) => {
      setSettings((prev) => ({ ...prev, ...data.settings }));
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const commissionPercent = (parseFloat(settings.platform_commission) * 100).toFixed(0);

  return (
    <AdminLayout title="Einstellungen">
      <div className="max-w-2xl space-y-6">
        {/* Bicycle Pricing */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Fahrradkurier Preise</h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Grundgebühr (€)" value={settings.bicycle_base_fee} onChange={(v) => update('bicycle_base_fee', v)} />
            <Field label="Preis pro km (€)" value={settings.bicycle_per_km} onChange={(v) => update('bicycle_per_km', v)} />
            <Field label="Mindestpreis (€)" value={settings.bicycle_min_price} onChange={(v) => update('bicycle_min_price', v)} />
          </div>
        </div>

        {/* Cargo Pricing */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Lastenrad Preise</h3>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Grundgebühr (€)" value={settings.cargo_base_fee} onChange={(v) => update('cargo_base_fee', v)} />
            <Field label="Preis pro km (€)" value={settings.cargo_per_km} onChange={(v) => update('cargo_per_km', v)} />
            <Field label="Mindestpreis (€)" value={settings.cargo_min_price} onChange={(v) => update('cargo_min_price', v)} />
          </div>
        </div>

        {/* Platform Settings */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Plattform</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Provision ({commissionPercent}%)</label>
              <input
                type="range"
                min="0"
                max="0.50"
                step="0.01"
                value={settings.platform_commission}
                onChange={(e) => update('platform_commission', e.target.value)}
                className="w-full accent-primary"
              />
              <p className="text-xs text-gray-400 mt-1">{commissionPercent}% vom Auftragspreis</p>
            </div>
            <Field
              label="Auftrags-Timeout (Minuten)"
              value={settings.ride_timeout_minutes}
              onChange={(v) => update('ride_timeout_minutes', v)}
              type="number"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
          {saved && (
            <p className="text-sm text-green-600 font-medium">Gespeichert! Änderungen gelten sofort für neue Aufträge.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={type === 'number' ? '1' : '0.01'}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}
