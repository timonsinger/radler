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
    basePrice: 'ab 3,00 €',
    perKm: '1,50 €/km',
  },
  {
    type: 'cargo_bike' as VehicleType,
    emoji: '🚛',
    name: 'Lastenrad',
    description: 'Größere Pakete',
    basePrice: 'ab 4,00 €',
    perKm: '2,00 €/km',
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
            className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all appearance-none overflow-hidden ${
              isSelected
                ? 'border-primary bg-primary-light'
                : 'border-gray-200 bg-white active:bg-gray-50'
            }`}
          >
            <span className="text-4xl mb-2">{v.emoji}</span>
            <span className="font-semibold text-gray-900 text-sm">{v.name}</span>
            <span className="text-xs text-gray-500 mt-0.5">{v.description}</span>
            <div className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${isSelected ? 'bg-primary text-primary-fg' : 'bg-gray-100 text-gray-600'}`}>
              {v.basePrice}
            </div>
            <span className="text-xs text-gray-400 mt-1">{v.perKm}</span>
          </button>
        );
      })}
    </div>
  );
}
