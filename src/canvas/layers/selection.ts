import type { Plan, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';
import { midpoint } from '../../geometry/point';
import { segmentAngle } from '../../geometry/segment';

const HANDLE_SIZE = 6; // px

function drawSquare(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  fill: string, stroke: string,
  size = HANDLE_SIZE
): void {
  const half = size / 2;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.fillRect(sx - half, sy - half, size, size);
  ctx.strokeRect(sx - half, sy - half, size, size);
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  plan: Plan,
  selectedIds: string[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  if (selectedIds.length === 0) return;
  const idSet = new Set(selectedIds);
  const isDark = settings.theme === 'dark';
  const handleFill = isDark ? '#3b82f6' : '#2563eb';
  const outlineColor = '#2563eb';

  ctx.save();

  for (const wall of plan.walls) {
    if (!idSet.has(wall.id)) continue;

    // Compute the four screen-space corners of the thick wall rect
    const angle = segmentAngle(wall.start, wall.end);
    const perpX = Math.sin(angle) * (wall.thickness / 2);
    const perpY = -Math.cos(angle) * (wall.thickness / 2);
    const worldCorners = [
      { x: wall.start.x + perpX, y: wall.start.y + perpY },
      { x: wall.end.x + perpX,   y: wall.end.y + perpY   },
      { x: wall.end.x - perpX,   y: wall.end.y - perpY   },
      { x: wall.start.x - perpX, y: wall.start.y - perpY },
    ];
    const sc = worldCorners.map(c => worldToScreen(c.x, c.y, viewport, ppcm));

    // Dashed bounding rect
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sc[0].x, sc[0].y);
    for (let i = 1; i < sc.length; i++) ctx.lineTo(sc[i].x, sc[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Endpoint handles (filled blue squares)
    const s1 = worldToScreen(wall.start.x, wall.start.y, viewport, ppcm);
    const s2 = worldToScreen(wall.end.x, wall.end.y, viewport, ppcm);
    drawSquare(ctx, s1.x, s1.y, handleFill, '#ffffff');
    drawSquare(ctx, s2.x, s2.y, handleFill, '#ffffff');

    // Midpoint handle (white fill, blue border)
    const mid = midpoint(wall.start, wall.end);
    const sm = worldToScreen(mid.x, mid.y, viewport, ppcm);
    drawSquare(ctx, sm.x, sm.y, '#ffffff', handleFill);
  }

  // Rooms: dashed outline (Phase 2 will add full room support)
  for (const room of plan.rooms) {
    if (!idSet.has(room.id)) continue;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    room.points.forEach((p, i) => {
      const s = worldToScreen(p.x, p.y, viewport, ppcm);
      i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
