import { useStore } from '../../store';

export function ZoomControls() {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const zoomIn = useStore(s => s.zoomIn);
  const zoomOut = useStore(s => s.zoomOut);
  const setCamera = useStore(s => s.setCamera);
  const isDark = useStore(s => s.settings.theme === 'dark');

  const zoom = (activePlanId ? plans[activePlanId]?.viewport.zoom : null) ?? 1;
  const pct = `${Math.round(zoom * 100)}%`;

  const bg = isDark ? 'rgba(37,37,38,0.92)' : 'rgba(255,255,255,0.92)';
  const border = isDark ? '#3a3a3a' : '#e5e7eb';
  const text = isDark ? '#d4d4d4' : '#374151';
  const hover = isDark ? '#3a3a3a' : '#f3f4f6';

  const btnClass = `w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`;

  return (
    <div
      className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded shadow-sm px-1 py-0.5"
      style={{ background: bg, border: `1px solid ${border}`, pointerEvents: 'auto' }}
    >
      <button
        className={btnClass}
        style={{ color: text }}
        title="Zoom out (Ctrl+−)"
        onClick={zoomOut}
        onMouseOver={e => (e.currentTarget.style.background = hover)}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        −
      </button>
      <button
        className="px-2 h-6 text-xs font-mono rounded transition-colors"
        style={{ color: text, minWidth: 46 }}
        title="Reset zoom (Ctrl+0)"
        onClick={() => setCamera({ zoom: 1.0, panX: 0, panY: 0 })}
        onMouseOver={e => (e.currentTarget.style.background = hover)}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        {pct}
      </button>
      <button
        className={btnClass}
        style={{ color: text }}
        title="Zoom in (Ctrl+=)"
        onClick={zoomIn}
        onMouseOver={e => (e.currentTarget.style.background = hover)}
        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
      >
        +
      </button>
    </div>
  );
}
