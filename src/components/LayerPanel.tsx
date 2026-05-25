import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, LockOpen, Plus, X } from 'lucide-react';
import { useStore } from '../store';
import type { LayerName } from '../types/tools';
import type { UserLayer } from '../types/plan';

const SYSTEM_LAYERS: { name: LayerName; label: string }[] = [
  { name: 'structure',   label: 'Structure'    },
  { name: 'furniture',   label: 'Furniture'    },
  { name: 'annotations', label: 'Annotations'  },
];

// ─── Inline-editable name for a user layer ────────────────────────────────────

function LayerNameField({ layer, onCommit }: { layer: UserLayer; onCommit: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local value in sync when layer name changes externally
  useEffect(() => { setValue(layer.name); }, [layer.name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim() || layer.name;
    setValue(trimmed);
    if (trimmed !== layer.name) onCommit(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(layer.name); setEditing(false); }
        }}
        className="flex-1 text-xs bg-transparent border-b border-blue-400 outline-none min-w-0 py-0"
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      className={`flex-1 text-xs truncate cursor-default select-none ${!layer.visible ? 'text-gray-400' : 'text-gray-700'}`}
    >
      {layer.name}
    </span>
  );
}

// ─── Single user layer row ────────────────────────────────────────────────────

function UserLayerRow({ layer }: { layer: UserLayer }) {
  const updateUserLayer = useStore(s => s.updateUserLayer);
  const deleteUserLayer = useStore(s => s.deleteUserLayer);
  const isDefault = layer.id === 'default';

  return (
    <div className="flex items-center gap-1.5 h-7 group">
      {/* Colour dot — acts as colour picker */}
      <label title="Layer colour" className="shrink-0 cursor-pointer">
        <span
          className="block w-3 h-3 rounded-full border border-gray-300"
          style={{ backgroundColor: layer.color }}
        />
        <input
          type="color"
          value={layer.color}
          onChange={e => updateUserLayer(layer.id, { color: e.target.value })}
          className="sr-only"
        />
      </label>

      {/* Editable name */}
      <LayerNameField
        layer={layer}
        onCommit={name => updateUserLayer(layer.id, { name })}
      />

      {/* Visibility toggle */}
      <button
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={() => updateUserLayer(layer.id, { visible: !layer.visible })}
        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded shrink-0"
      >
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>

      {/* Delete — hidden for the Default layer */}
      {!isDefault && (
        <button
          title="Delete layer"
          onClick={() => deleteUserLayer(layer.id)}
          className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      )}
      {/* Spacer to keep alignment when delete button is hidden */}
      {isDefault && <span className="w-5 shrink-0" />}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function LayerPanel() {
  const systemLayers = useStore(s => s.layers);
  const setLayer     = useStore(s => s.setLayer);
  const activePlanId = useStore(s => s.activePlanId);
  const userLayers   = useStore(s => activePlanId ? (s.plans[activePlanId]?.userLayers ?? []) : []);
  const addUserLayer = useStore(s => s.addUserLayer);

  return (
    <div className="fp-panel border-t border-gray-200 px-3 py-2 shrink-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Layers</p>

      {/* ── System layers ── */}
      <div className="flex flex-col gap-0.5 mb-2">
        {SYSTEM_LAYERS.map(({ name, label }) => {
          const { visible, locked } = systemLayers[name];
          return (
            <div key={name} className="flex items-center gap-1.5 h-7">
              {/* Spacer to align with user layer colour dots */}
              <span className="w-3 shrink-0" />
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

      {/* ── User layers header ── */}
      <div className="flex items-center gap-1 mb-0.5">
        <p className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">User layers</p>
        <button
          title="Add layer"
          onClick={() => addUserLayer()}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 rounded"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* ── User layer rows ── */}
      <div className="flex flex-col gap-0.5">
        {userLayers.map(layer => (
          <UserLayerRow key={layer.id} layer={layer} />
        ))}
      </div>
    </div>
  );
}
