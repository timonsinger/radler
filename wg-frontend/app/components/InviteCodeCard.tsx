'use client';

import { useState } from 'react';

interface InviteCodeCardProps {
  code: string;
  wgName: string;
}

export default function InviteCodeCard({ code, wgName }: InviteCodeCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 space-y-2">
      <p className="text-xs text-gray-500 font-medium">Einladungscode für {wgName}</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-mono font-bold tracking-[0.3em] text-accent flex-1">{code}</span>
        <button
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            copied ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent hover:bg-accent/20'
          }`}
        >
          {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>
    </div>
  );
}
