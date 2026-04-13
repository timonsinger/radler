type Status = 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled' | 'expired';

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
        <span className="text-error font-semibold">Storniert</span>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="text-gray-500 font-semibold">Abgelaufen</span>
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
                {/* Linie links */}
                {i > 0 && (
                  <div className={`flex-1 h-0.5 ${done || active ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
                {/* Punkt */}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    done
                      ? 'bg-primary'
                      : active
                      ? 'bg-primary ring-4 ring-primary/20 animate-pulse'
                      : 'bg-gray-200'
                  }`}
                />
                {/* Linie rechts */}
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${done ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </div>
              <span className={`text-xs mt-1.5 text-center ${active ? 'text-primary font-semibold' : done ? 'text-primary' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
