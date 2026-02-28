import { useStore } from '../store';
import type { UserSettings } from '../types/settings';

interface Props {
  onClose(): void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4 first:mt-0">
      {children}
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-accent' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-1'}`}
      />
    </button>
  );
}

export function SettingsModal({ onClose }: Props) {
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);

  function patch(changes: Partial<UserSettings>) {
    updateSettings(changes);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-80 flex flex-col fp-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">

          {/* Appearance */}
          <SectionTitle>Appearance</SectionTitle>
          <Row label="Dark theme">
            <Toggle
              checked={settings.theme === 'dark'}
              onChange={v => patch({ theme: v ? 'dark' : 'light' })}
            />
          </Row>

          {/* Units */}
          <SectionTitle>Units</SectionTitle>
          <Row label="Display unit">
            <select
              value={settings.displayUnit}
              onChange={e => patch({ displayUnit: e.target.value as UserSettings['displayUnit'] })}
              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="cm">Centimetres (cm)</option>
              <option value="m">Metres (m)</option>
              <option value="ft">Feet (ft)</option>
            </select>
          </Row>

          {/* Drawing defaults */}
          <SectionTitle>Drawing defaults</SectionTitle>
          <Row label="Wall thickness (cm)">
            <input
              type="number"
              min={1}
              max={100}
              value={settings.defaultWallThickness}
              onChange={e => patch({ defaultWallThickness: Math.max(1, parseInt(e.target.value, 10) || 15) })}
              className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Row>
          <Row label="Grid size (cm)">
            <input
              type="number"
              min={1}
              max={500}
              value={settings.defaultGridSize}
              onChange={e => patch({ defaultGridSize: Math.max(1, parseInt(e.target.value, 10) || 10) })}
              className="w-20 text-sm border border-gray-200 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </Row>
          <Row label="Show dimension labels">
            <Toggle
              checked={settings.showDimensions}
              onChange={v => patch({ showDimensions: v })}
            />
          </Row>

          {/* Snapping */}
          <SectionTitle>Snapping</SectionTitle>
          <Row label="Snap to grid">
            <Toggle
              checked={settings.snapToGrid}
              onChange={v => patch({ snapToGrid: v })}
            />
          </Row>
          <Row label="Snap to endpoints">
            <Toggle
              checked={settings.snapToEndpoint}
              onChange={v => patch({ snapToEndpoint: v })}
            />
          </Row>
          <Row label="Snap to midpoints">
            <Toggle
              checked={settings.snapToMidpoint}
              onChange={v => patch({ snapToMidpoint: v })}
            />
          </Row>
          <Row label="Snap to angle (15°)">
            <Toggle
              checked={settings.snapToAngle}
              onChange={v => patch({ snapToAngle: v })}
            />
          </Row>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
