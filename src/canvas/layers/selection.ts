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

  // Furniture: dashed outline + corner handles + rotation handle
  for (const item of plan.furniture) {
    if (!idSet.has(item.id)) continue;

    const rotRad = item.rotation * Math.PI / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    const hw = item.width / 2;
    const hd = item.depth / 2;
    const cx = item.position.x;
    const cy = item.position.y;

    // 4 rotated corners in world space (tl, tr, br, bl)
    const worldCorners = [
      { x: cx + cos * (-hw) - sin * (-hd), y: cy + sin * (-hw) + cos * (-hd) },
      { x: cx + cos *   hw  - sin * (-hd), y: cy + sin *   hw  + cos * (-hd) },
      { x: cx + cos *   hw  - sin *   hd,  y: cy + sin *   hw  + cos *   hd  },
      { x: cx + cos * (-hw) - sin *   hd,  y: cy + sin * (-hw) + cos *   hd  },
    ];
    const sc = worldCorners.map(c => worldToScreen(c.x, c.y, viewport, ppcm));

    // Dashed bounding outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sc[0].x, sc[0].y);
    for (let i = 1; i < sc.length; i++) ctx.lineTo(sc[i].x, sc[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner resize handles
    for (const s of sc) drawSquare(ctx, s.x, s.y, handleFill, '#ffffff');

    // Rotation handle: 24 screen-px above the top-center (local top = (0, -hd))
    const topCenterWorld = { x: cx + sin * hd, y: cy - cos * hd };
    const stc = worldToScreen(topCenterWorld.x, topCenterWorld.y, viewport, ppcm);
    const rhx = stc.x + sin * 24;
    const rhy = stc.y - cos * 24;

    // Stem line
    ctx.beginPath();
    ctx.moveTo(stc.x, stc.y);
    ctx.lineTo(rhx, rhy);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rotation handle circle (8px radius)
    ctx.beginPath();
    ctx.arc(rhx, rhy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = handleFill;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Openings: dashed rectangle aligned to wall direction
  for (const opening of plan.openings) {
    if (!idSet.has(opening.id)) continue;
    const wall = plan.walls.find(w => w.id === opening.wallId);
    if (!wall) continue;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLen = Math.hypot(dx, dy);
    if (wallLen < 1) continue;
    const ux = dx / wallLen;
    const uy = dy / wallLen;
    const cx = wall.start.x + ux * wallLen * opening.position;
    const cy = wall.start.y + uy * wallLen * opening.position;
    const hw = opening.width / 2;
    const ht = wall.thickness / 2;
    const worldCorners = [
      { x: cx + ux * hw - uy * ht, y: cy + uy * hw + ux * ht },
      { x: cx + ux * hw + uy * ht, y: cy + uy * hw - ux * ht },
      { x: cx - ux * hw + uy * ht, y: cy - uy * hw - ux * ht },
      { x: cx - ux * hw - uy * ht, y: cy - uy * hw + ux * ht },
    ];
    const sc = worldCorners.map(c => worldToScreen(c.x, c.y, viewport, ppcm));
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sc[0].x, sc[0].y);
    for (let i = 1; i < sc.length; i++) ctx.lineTo(sc[i].x, sc[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // Center handle
    const sc_center = worldToScreen(cx, cy, viewport, ppcm);
    drawSquare(ctx, sc_center.x, sc_center.y, '#ffffff', handleFill);
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
