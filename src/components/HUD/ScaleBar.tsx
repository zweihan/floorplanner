import { useStore } from '../../store';
import { PPCM } from '../../geometry/transforms';
import { formatMeasurement } from '../../geometry/units';
import type { DisplayUnit } from '../../types/plan';

function niceScaleLength(
  zoom: number,
  displayUnit: DisplayUnit
): { barPx: number; label: string } {
  const worldCm = 100 / (PPCM * zoom); // world cm that maps to 100 screen px
  const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const nice = niceValues.find(v => v >= worldCm) ?? 5000;
  const barPx = nice * PPCM * zoom;
  return { barPx, label: formatMeasurement(nice, displayUnit) };
}

export function ScaleBar() {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const settings = useStore(s => s.settings);

  const zoom = (activePlanId ? plans[activePlanId]?.viewport.zoom : null) ?? 1;
  const isDark = settings.theme === 'dark';
  const { barPx, label } = niceScaleLength(zoom, settings.displayUnit);

  const color = isDark ? '#cccccc' : '#444444';

  return (
    <div
      className="absolute bottom-4 left-4 flex flex-col items-center"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          width: barPx,
          height: 4,
          background: color,
          border: `1px solid ${color}`,
          borderRadius: 1,
        }}
      />
      <span
        style={{
          marginTop: 3,
          fontSize: 11,
          fontFamily: 'monospace',
          color,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}
