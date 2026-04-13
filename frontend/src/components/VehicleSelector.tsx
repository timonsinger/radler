type VehicleType = 'bicycle' | 'cargo_bike';

interface Props {
  selected: VehicleType | null;
  onSelect: (type: VehicleType) => void;
}

const VEHICLES = [
  {
    type: 'bicycle' as VehicleType,
    emoji: '🚲',
    name: 'Fahrradkurier',
    description: 'Rucksack-Größe',
    basePrice: 'ab 5,50 €',
    perKm: '4€ + 1,50€/km',
  },
  {
    type: 'cargo_bike' as VehicleType,
    emoji: '🚛',
    name: 'Lastenrad',
    description: 'Größere Pakete',
    basePrice: 'ab 8,00 €',
    perKm: '6€ + 2,00€/km',
  },
];

export default function VehicleSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {VEHICLES.map((v) => {
        const isSelected = selected === v.type;
        return (
          <button
            key={v.type}
            onClick={() => onSelect(v.type)}
            className={`flex flex-col items-center p-4 rounded-[12px] border-2 transition-all appearance-none overflow-hidden ${
              isSelected
                ? 'border-radler-green-500 bg-radler-green-50'
                : 'border-radler-ink-200 bg-white active:bg-radler-ink-100'
            }`}
            style={{ transitionDuration: 'var(--duration-fast)' }}
          >
            <span className="text-4xl mb-2">{v.emoji}</span>
            <span className="font-heading font-semibold text-radler-ink-800 text-sm">{v.name}</span>
            <span className="font-body text-xs text-radler-ink-400 mt-0.5">{v.description}</span>
            <div className={`mt-2 px-2.5 py-0.5 rounded-[20px] text-xs font-body font-semibold ${
              isSelected ? 'bg-radler-green-500 text-white' : 'bg-radler-ink-100 text-radler-ink-600'
            }`}>
              {v.basePrice}
            </div>
            <span className="font-mono text-xs text-radler-ink-300 mt-1">{v.perKm}</span>
          </button>
        );
      })}
    </div>
  );
}
