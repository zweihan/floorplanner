import type { Wall, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  const isDark = settings.theme === 'dark';

  for (const wall of walls) {
    const s = worldToScreen(wall.start.x, wall.start.y, viewport, ppcm);
    const e = worldToScreen(wall.end.x, wall.end.y, viewport, ppcm);
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;

    const angle = Math.atan2(dy, dx);
    const halfThick = (wall.thickness / 2) * ppcm * viewport.zoom;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    // Fill
    ctx.fillStyle = isDark ? '#cccccc' : wall.color;
    ctx.fillRect(0, -halfThick, len, halfThick * 2);

    // Thin border
    ctx.strokeStyle = isDark ? '#999999' : '#1a1a1a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, -halfThick, len, halfThick * 2);

    ctx.restore();
  }
}
