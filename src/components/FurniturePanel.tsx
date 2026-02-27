import { useStore } from '../store';
import { FURNITURE_TEMPLATES } from '../data/furnitureTemplates';

export function FurniturePanel() {
  const pendingId = useStore(s => s.pendingFurnitureTemplateId);
  const setPending = useStore(s => s.setPendingFurnitureTemplate);

  return (
    <div className="w-28 bg-white border-r border-gray-200 shrink-0 flex flex-col overflow-hidden">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">
        Furniture
      </p>
      <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1 p-1.5 content-start">
        {FURNITURE_TEMPLATES.map(tpl => (
          <button
            key={tpl.id}
            title={tpl.label}
            onClick={() => setPending(pendingId === tpl.id ? null : tpl.id)}
            className={`flex flex-col items-center gap-0.5 p-1 rounded text-center transition-colors
              ${pendingId === tpl.id
                ? 'bg-blue-100 ring-1 ring-blue-400 text-blue-700'
                : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {ICONS[tpl.id] ?? '▭'}
            </span>
            <span className="text-[9px] leading-tight truncate w-full">{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const ICONS: Record<string, string> = {
  sofa:    '🛋',
  bed:     '🛏',
  table:   '⬜',
  chair:   '🪑',
  desk:    '🖥',
  toilet:  '🚽',
  bathtub: '🛁',
  sink:    '🚰',
  stove:   '🍳',
  fridge:  '🧊',
};
