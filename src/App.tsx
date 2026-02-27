import { useStore } from './store';
import { CanvasContainer } from './canvas/CanvasContainer';
import { useKeyboardShortcuts } from './canvas/interaction/useKeyboardShortcuts';
import { usePlanPersistence } from './hooks/usePlanPersistence';
import { ToastContainer } from './components/ToastContainer';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FurniturePanel } from './components/FurniturePanel';

// Placeholder components — will be implemented in subsequent checkpoints
function Header() {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const planName = activePlanId ? plans[activePlanId]?.name : 'No plan';

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0 z-10">
      <span className="font-semibold text-gray-800 text-sm">FloorPlanner</span>
      <span className="text-gray-400 text-sm">|</span>
      <span className="text-gray-600 text-sm">{planName}</span>
    </header>
  );
}

function Toolbar() {
  const activeTool = useStore(s => s.activeTool);
  const setActiveTool = useStore(s => s.setActiveTool);
  const tools = ['select', 'wall', 'room', 'door', 'window', 'opening', 'furniture', 'dimension', 'text', 'eraser', 'pan'] as const;

  return (
    <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-1 shrink-0">
      {tools.map(tool => (
        <button
          key={tool}
          title={tool}
          onClick={() => setActiveTool(tool)}
          className={`w-8 h-8 rounded text-xs font-mono uppercase flex items-center justify-center
            ${activeTool === tool ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          {tool[0]}
        </button>
      ))}
    </div>
  );
}



function StatusBar() {
  const activeTool = useStore(s => s.activeTool);
  return (
    <footer className="h-6 bg-gray-50 border-t border-gray-200 flex items-center px-3 gap-4 text-xs text-gray-500 shrink-0">
      <span>Tool: {activeTool}</span>
    </footer>
  );
}

export default function App() {
  useKeyboardShortcuts();
  usePlanPersistence();
  const activeTool = useStore(s => s.activeTool);
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        {activeTool === 'furniture' && <FurniturePanel />}
        <CanvasContainer />
        <PropertiesPanel />
      </div>
      <StatusBar />
      <ToastContainer />
    </div>
  );
}
