type Status = 'pending' | 'scheduled' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled' | 'expired';

const STEPS = [
  { key: 'pending', label: 'Gebucht' },
  { key: 'accepted', label: 'Kurier kommt' },
  { key: 'picked_up', label: 'Abgeholt' },
  { key: 'delivered', label: 'Zugestellt' },
];

const STATUS_INDEX: Record<string, number> = {
  pending: 0,
  accepted: 1,
  picked_up: 2,
  delivered: 3,
};

export default function StatusBar({ status }: { status: Status }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="font-body font-semibold text-radler-coral-400">Storniert</span>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="font-body font-semibold text-radler-ink-400">Abgelaufen</span>
      </div>
    );
  }

  if (status === 'scheduled') {
    return (
      <div className="flex items-center justify-center py-3 gap-2">
        <span className="text-lg">📅</span>
        <span className="font-body font-semibold text-purple-600">Geplant</span>
      </div>
    );
  }

  const currentIndex = STATUS_INDEX[status] ?? 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 ${done || active ? 'bg-radler-green-500' : 'bg-radler-ink-200'}`} />
                )}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    done
                      ? 'bg-radler-green-500'
                      : active
                      ? 'bg-radler-green-500 ring-4 ring-radler-green-500/20 animate-pulse'
                      : 'bg-radler-ink-200'
                  }`}
                />
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${done ? 'bg-radler-green-500' : 'bg-radler-ink-200'}`} />
                )}
              </div>
              <span className={`font-body text-xs mt-1.5 text-center ${active ? 'text-radler-green-500 font-semibold' : done ? 'text-radler-green-500' : 'text-radler-ink-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
