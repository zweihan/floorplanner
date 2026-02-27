import { useStore } from '../../store';
import { formatMeasurement } from '../../geometry/units';

export function CoordinateDisplay() {
  const ghostPoint = useStore(s => s.ghostPoint);
  const settings = useStore(s => s.settings);

  if (!ghostPoint) return null;

  const fmt = (v: number) => formatMeasurement(v, settings.displayUnit);
  const isDark = settings.theme === 'dark';

  return (
    <div
      className="absolute bottom-10 right-4 text-xs font-mono rounded px-2 py-0.5 select-none"
      style={{
        background: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
        color: isDark ? '#cccccc' : '#555555',
        pointerEvents: 'none',
        border: `1px solid ${isDark ? '#444' : '#e5e7eb'}`,
      }}
    >
      x: {fmt(ghostPoint.x)}&nbsp;&nbsp;y: {fmt(ghostPoint.y)}
    </div>
  );
}
