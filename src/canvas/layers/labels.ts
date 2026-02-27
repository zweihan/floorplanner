import type { Wall, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen, PPCM } from '../../geometry/transforms';
import { distance } from '../../geometry/point';
import { formatMeasurement } from '../../geometry/units';

/**
 * Renders wall length labels at each wall's midpoint.
 * Skips walls whose screen length is under 40 px (too short to read).
 */
export function drawWallLabels(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  viewport: Viewport,
  settings: UserSettings
): void {
  const isDark = settings.theme === 'dark';

  ctx.save();
  ctx.font = '11px system-ui, sans-serif';

  for (const wall of walls) {
    const s = worldToScreen(wall.start.x, wall.start.y, viewport, PPCM);
    const e = worldToScreen(wall.end.x, wall.end.y, viewport, PPCM);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const screenLen = Math.hypot(dx, dy);

    if (screenLen < 40) continue;

    const midX = (s.x + e.x) / 2;
    const midY = (s.y + e.y) / 2;
    const angle = Math.atan2(dy, dx);

    const lenCm = distance(wall.start, wall.end);
    const text = formatMeasurement(lenCm, settings.displayUnit);

    const halfThickScreen = (wall.thickness / 2) * PPCM * viewport.zoom;
    const offset = halfThickScreen + 4; // px above wall top edge

    ctx.save();
    ctx.translate(midX, midY);

    // Keep text upright: flip if wall goes right-to-left
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      ctx.rotate(angle + Math.PI);
    } else {
      ctx.rotate(angle);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const tw = ctx.measureText(text).width + 4;
    const th = 11;

    // Subtle background for readability
    ctx.fillStyle = isDark ? 'rgba(30,30,30,0.75)' : 'rgba(250,249,247,0.85)';
    ctx.fillRect(-tw / 2, -(offset + th), tw, th);

    ctx.fillStyle = isDark ? '#bbbbbb' : '#555555';
    ctx.fillText(text, 0, -offset);
    ctx.restore();
  }

  ctx.restore();
}
