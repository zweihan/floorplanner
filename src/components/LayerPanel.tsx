import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import { useStore } from '../store';
import type { LayerName } from '../types/tools';

const LAYERS: { name: LayerName; label: string }[] = [
  { name: 'structure',   label: 'Structure'    },
  { name: 'furniture',   label: 'Furniture'    },
  { name: 'annotations', label: 'Annotations'  },
];

export function LayerPanel() {
  const layers = useStore(s => s.layers);
  const setLayer = useStore(s => s.setLayer);

  return (
    <div className="fp-panel border-t border-gray-200 px-3 py-2 shrink-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Layers</p>
      <div className="flex flex-col gap-0.5">
        {LAYERS.map(({ name, label }) => {
          const { visible, locked } = layers[name];
          return (
            <div key={name} className="flex items-center gap-1.5 h-7">
              <span className={`flex-1 text-xs truncate ${!visible ? 'text-gray-400' : 'text-gray-700'}`}>
                {label}
              </span>
              <button
                title={visible ? 'Hide layer' : 'Show layer'}
                onClick={() => setLayer(name, { visible: !visible })}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"
              >
                {visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button
                title={locked ? 'Unlock layer' : 'Lock layer'}
                onClick={() => setLayer(name, { locked: !locked })}
                className={`w-5 h-5 flex items-center justify-center rounded ${locked ? 'text-amber-500 hover:text-amber-700' : 'text-gray-400 hover:text-gray-700'}`}
              >
                {locked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
