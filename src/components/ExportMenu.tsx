import { useRef, useState } from 'react';
import { useStore } from '../store';
import { exportPNG } from '../canvas/export';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const settings = useStore(s => s.settings);
  const exportJSON = useStore(s => s.exportJSON);
  const importJSON = useStore(s => s.importJSON);
  const addToast = useStore(s => s.addToast);

  function handleExportPNG(scale: 1 | 2 | 4) {
    if (!activePlanId) return;
    setOpen(false);
    exportPNG(plans[activePlanId], settings, scale);
  }

  function handleExportJSON() {
    setOpen(false);
    const json = exportJSON();
    const activePlan = activePlanId ? plans[activePlanId] : null;
    const fileName = (activePlan?.name ?? 'floorplan').replace(/[^a-z0-9_\-]/gi, '_') + '.json';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON() {
    setOpen(false);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const err = importJSON(text);
      if (err) {
        addToast(err, 'error');
      } else {
        addToast('Plan imported successfully.', 'info');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-7 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1"
      >
        Export ▾
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded shadow-lg py-1 w-44">
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">PNG</div>
            {([1, 2, 4] as const).map(scale => (
              <button
                key={scale}
                onClick={() => handleExportPNG(scale)}
                className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                Export PNG {scale}×
              </button>
            ))}
            <hr className="my-1 border-gray-100" />
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">JSON</div>
            <button
              onClick={handleExportJSON}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Export JSON
            </button>
            <button
              onClick={handleImportJSON}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Import JSON…
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
