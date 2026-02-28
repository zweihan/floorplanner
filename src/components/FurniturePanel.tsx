import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { FURNITURE_TEMPLATES } from '../data/furnitureTemplates';

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
  cabinet: '🗄',
};

export function FurniturePanel() {
  const pendingId = useStore(s => s.pendingFurnitureTemplateId);
  const setPending = useStore(s => s.setPendingFurnitureTemplate);

  // Group templates by category, preserving insertion order
  const groups = useMemo(() => {
    const map = new Map<string, typeof FURNITURE_TEMPLATES>();
    for (const tpl of FURNITURE_TEMPLATES) {
      if (!map.has(tpl.category)) map.set(tpl.category, []);
      map.get(tpl.category)!.push(tpl);
    }
    return [...map.entries()];
  }, []);

  // All categories expanded by default
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCategory(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  return (
    <div className="w-28 bg-white border-r border-gray-200 shrink-0 flex flex-col overflow-hidden">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 pt-2 pb-1">
        Furniture
      </p>
      <div className="flex-1 overflow-y-auto">
        {groups.map(([category, templates]) => {
          const isCollapsed = collapsed.has(category);
          return (
            <div key={category}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-1 px-2 py-1 text-[9px] font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight size={10} className="shrink-0" />
                  : <ChevronDown size={10} className="shrink-0" />}
                {category}
              </button>

              {/* Template grid */}
              {!isCollapsed && (
                <div className="grid grid-cols-2 gap-1 px-1.5 pb-1.5">
                  {templates.map(tpl => (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
