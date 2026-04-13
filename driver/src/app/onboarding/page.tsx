'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface StepData {
  title: string;
  subtitle: string;
  emoji: string;
  content: React.ReactNode;
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
      <p className="text-xs text-blue-700">{children}</p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleComplete() {
    setSaving(true);
    try {
      await apiFetch('/api/drivers/onboarding-complete', { method: 'PATCH' });
      router.replace('/dashboard');
    } catch (err) {
      console.error('Fehler:', err);
    } finally {
      setSaving(false);
    }
  }

  const steps: StepData[] = [
    {
      title: 'Gewerbe anmelden',
      subtitle: '~20-60€ einmalig',
      emoji: '📋',
      content: (
        <>
          <p className="text-sm text-gray-700 mb-3">
            Als Radler-Fahrer bist du selbstständig. Du brauchst ein Kleingewerbe.
            Das geht in 15 Minuten beim Gewerbeamt oder online.
          </p>
          <div className="space-y-2">
            <CheckItem>Personalausweis mitnehmen</CheckItem>
            <CheckItem>Tätigkeitsbeschreibung: &quot;Kurierdienst per Fahrrad&quot;</CheckItem>
            <CheckItem>Beim Gewerbeamt deiner Stadt anmelden</CheckItem>
            <CheckItem>Kostet ca. 20-60€ einmalig</CheckItem>
          </div>
          <InfoBox>
            Unter der Kleinunternehmerregelung (§19 UStG) zahlst du keine Umsatzsteuer,
            solange du unter 22.000€/Jahr bleibst.
          </InfoBox>
          <a
            href="https://www.google.com/maps/search/Gewerbeamt+Konstanz"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Gewerbeamt Konstanz finden
          </a>
        </>
      ),
    },
    {
      title: 'Versicherung',
      subtitle: '~50-150€/Jahr',
      emoji: '🛡️',
      content: (
        <>
          <p className="text-sm text-gray-700 mb-3">
            Du brauchst eine Betriebshaftpflichtversicherung für Kurierdienste.
            Die deckt Schäden ab, die beim Transport entstehen können.
          </p>
          <div className="space-y-2">
            <CheckItem>Betriebshaftpflichtversicherung für Kurierfahrer abschließen</CheckItem>
            <CheckItem>Empfehlung: Haftpflichthelden.de oder Exali.de (online, schnell)</CheckItem>
            <CheckItem>Kostet ca. 50-150€ pro Jahr (ca. 5-12€/Monat)</CheckItem>
          </div>
          <InfoBox>
            Bei Rikscha-Fahrten mit Fahrgästen brauchst du zusätzlich eine
            Fahrgastunfallversicherung (~100-300€/Jahr). Für reine Kurierdienste
            reicht die Betriebshaftpflicht.
          </InfoBox>
        </>
      ),
    },
    {
      title: 'Fahrrad vorbereiten',
      subtitle: 'Equipment-Check',
      emoji: '🚲',
      content: (
        <div className="space-y-2">
          <CheckItem>Funktionstüchtiges Fahrrad mit Licht und Bremsen</CheckItem>
          <CheckItem>Für Lastenrad-Aufträge: Lastenrad mit ausreichend Stauraum</CheckItem>
          <CheckItem>Helm empfohlen</CheckItem>
          <CheckItem>Smartphone-Halterung fürs Lenker (für Navigation)</CheckItem>
          <CheckItem>Rucksack oder Transporttasche</CheckItem>
        </div>
      ),
    },
    {
      title: 'App einrichten',
      subtitle: 'Profil & GPS',
      emoji: '📱',
      content: (
        <div className="space-y-2">
          <CheckItem>Profil ausfüllen (Name, Foto, Fahrzeugtyp)</CheckItem>
          <CheckItem>GPS-Berechtigung erlauben (wichtig für Aufträge!)</CheckItem>
          <CheckItem>Abholradius und max. Fahrtdistanz einstellen</CheckItem>
          <CheckItem>Online gehen und auf den ersten Auftrag warten!</CheckItem>
        </div>
      ),
    },
    {
      title: 'Steuern',
      subtitle: 'Keine Panik',
      emoji: '🧾',
      content: (
        <>
          <p className="text-sm text-gray-700 mb-3">
            Als Kleinunternehmer musst du einmal im Jahr eine Steuererklärung machen.
            Dein Verdienst über Radler wird in deiner Auftragshistorie dokumentiert.
          </p>
          <div className="space-y-2">
            <CheckItem>Alle Einnahmen werden in der App aufgezeichnet</CheckItem>
            <CheckItem>Ausgaben (Fahrradreparatur, Versicherung, Handy) sind absetzbar</CheckItem>
            <CheckItem>Empfehlung: Taxfix oder Wiso Steuer App für die Steuererklärung</CheckItem>
            <CheckItem>Unter 22.000€/Jahr: keine Umsatzsteuer (Kleinunternehmerregelung)</CheckItem>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-primary px-5 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Fahrer-Anleitung</h1>
            <p className="text-white/60 text-xs">Schritt für Schritt</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-2">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">{step.emoji}</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Schritt {i + 1}</p>
                <p className="font-bold text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500">{step.subtitle}</p>
              </div>
            </div>
            <div className="px-5 pb-5 pt-2">
              {step.content}
            </div>
          </div>
        ))}

        {/* Provision Info */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">💶</span>
            <p className="font-bold text-gray-900">Verdienst & Provision</p>
          </div>
          <p className="text-sm text-gray-700">
            Pro abgeschlossenem Auftrag erhältst du <strong>85% des Auftragspreises</strong>.
            Radler behält 15% als Vermittlungsprovision.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Fahrradkurier</p>
              <p className="text-sm font-bold">ab 5,50€</p>
              <p className="text-xs text-gray-500">4€ + 1,50€/km</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Lastenrad</p>
              <p className="text-sm font-bold">ab 8,00€</p>
              <p className="text-xs text-gray-500">6€ + 2,00€/km</p>
            </div>
          </div>
        </div>

        {/* Bestätigung */}
        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded accent-primary"
            />
            <span className="text-sm text-gray-700">
              Ich habe die Anleitung gelesen und ein Gewerbe angemeldet oder werde dies zeitnah tun.
            </span>
          </label>

          <button
            onClick={handleComplete}
            disabled={!confirmed || saving}
            className="w-full bg-primary text-white font-black text-lg py-5 rounded-2xl active:bg-primary/80 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Wird gespeichert...' : 'Verstanden, zum Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
