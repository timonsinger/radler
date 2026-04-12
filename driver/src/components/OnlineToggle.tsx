'use client';

interface Props {
  isOnline: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export default function OnlineToggle({ isOnline, onToggle, loading }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onToggle}
        disabled={loading}
        className={`
          w-36 h-36 rounded-full font-black text-lg tracking-widest
          flex items-center justify-center
          transition-all duration-300 select-none
          disabled:opacity-70
          ${isOnline
            ? 'bg-online text-white shadow-2xl shadow-online/40 animate-pulse-online'
            : 'bg-offline text-white shadow-xl'
          }
        `}
      >
        {loading ? (
          <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          isOnline ? 'ONLINE' : 'OFFLINE'
        )}
      </button>
      <p className="text-sm text-gray-500 font-medium">
        {loading ? 'Bitte warten...' : isOnline ? 'Warte auf Aufträge...' : 'Tippe um online zu gehen'}
      </p>
    </div>
  );
}
