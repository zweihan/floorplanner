import { useState, useEffect } from 'react';
import {
  MousePointer2, PenLine, Pentagon, DoorOpen, AppWindow, Square,
  Sofa, Ruler, Type, Eraser, Hand,
} from 'lucide-react';
import { useStore } from './store';
import { CanvasContainer } from './canvas/CanvasContainer';
import { useKeyboardShortcuts } from './canvas/interaction/useKeyboardShortcuts';
import { usePlanPersistence } from './hooks/usePlanPersistence';
import { ToastContainer } from './components/ToastContainer';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FurniturePanel } from './components/FurniturePanel';
import { ExportMenu } from './components/ExportMenu';
import { PlanListModal } from './components/PlanListModal';
import { SettingsModal } from './components/SettingsModal';

function Header({ onOpenSettings }: { onOpenSettings(): void }) {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const updateDocument = useStore(s => s.updateDocument);
  const planCount = Object.keys(plans).length;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showPlanList, setShowPlanList] = useState(false);

  const planName = activePlanId ? plans[activePlanId]?.name : 'No plan';

  function startEdit() {
    setNameValue(planName ?? '');
    setEditingName(true);
  }

  function commitEdit() {
    const trimmed = nameValue.trim();
    if (trimmed) updateDocument({ name: trimmed });
    setEditingName(false);
  }

  return (
    <>
      <header className="fp-toolbar h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 z-10">
        <span className="font-semibold text-gray-800 text-sm select-none">FloorPlanner</span>
        <span className="text-gray-300">|</span>

        {/* Plan name — double-click to rename */}
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="text-sm border border-blue-300 rounded px-2 py-0.5 outline-none w-48"
          />
        ) : (
          <span
            className="text-sm text-gray-700 cursor-text hover:text-gray-900"
            onDoubleClick={startEdit}
            title="Double-click to rename"
          >
            {planName}
          </span>
        )}

        {/* Plan switcher button */}
        <button
          onClick={() => setShowPlanList(true)}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
          title="Manage plans"
        >
          {planCount > 1 ? `▾ ${planCount} plans` : '▾'}
        </button>

        <div className="flex-1" />

        {/* Settings gear */}
        <button
          onClick={onOpenSettings}
          className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Settings"
        >
          ⚙
        </button>

        <ExportMenu />
      </header>

      {showPlanList && <PlanListModal onClose={() => setShowPlanList(false)} />}
    </>
  );
}

const TOOL_META = [
  { tool: 'select',    label: 'Select',    key: 'V', Icon: MousePointer2 },
  { tool: 'wall',      label: 'Wall',      key: 'W', Icon: PenLine       },
  { tool: 'room',      label: 'Room',      key: 'R', Icon: Pentagon       },
  { tool: 'door',      label: 'Door',      key: 'D', Icon: DoorOpen       },
  { tool: 'window',    label: 'Window',    key: 'N', Icon: AppWindow      },
  { tool: 'opening',   label: 'Opening',   key: 'O', Icon: Square         },
  { tool: 'furniture', label: 'Furniture', key: 'F', Icon: Sofa           },
  { tool: 'dimension', label: 'Dimension', key: 'M', Icon: Ruler          },
  { tool: 'text',      label: 'Text',      key: 'T', Icon: Type           },
  { tool: 'eraser',    label: 'Eraser',    key: 'E', Icon: Eraser         },
  { tool: 'pan',       label: 'Pan',       key: 'H', Icon: Hand           },
] as const;

function Toolbar() {
  const activeTool = useStore(s => s.activeTool);
  const setActiveTool = useStore(s => s.setActiveTool);

  return (
    <div className="fp-toolbar w-12 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-1 shrink-0">
      {TOOL_META.map(({ tool, label, key, Icon }) => (
        <button
          key={tool}
          title={`${label} (${key})`}
          aria-label={`${label} (${key})`}
          onClick={() => setActiveTool(tool)}
          className={`w-8 h-8 rounded flex items-center justify-center
            ${activeTool === tool ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

function StatusBar() {
  const activeTool = useStore(s => s.activeTool);
  return (
    <footer className="fp-statusbar h-6 bg-gray-50 border-t border-gray-200 flex items-center px-3 gap-4 text-xs text-gray-500 shrink-0">
      <span>Tool: {activeTool}</span>
    </footer>
  );
}

export default function App() {
  useKeyboardShortcuts();
  usePlanPersistence();

  const activeTool = useStore(s => s.activeTool);
  const theme = useStore(s => s.settings.theme);
  const [showSettings, setShowSettings] = useState(false);

  // Sync dark class on <html> with user's theme preference
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Header onOpenSettings={() => setShowSettings(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        {activeTool === 'furniture' && <FurniturePanel />}
        <CanvasContainer />
        <PropertiesPanel />
      </div>
      <StatusBar />
      <ToastContainer />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
