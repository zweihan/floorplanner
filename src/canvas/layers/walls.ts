import type { Wall, Opening, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  openings: Opening[],
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

    // Compute gap intervals from openings on this wall
    const worldLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    const wallOpenings = openings
      .filter(o => o.wallId === wall.id)
      .sort((a, b) => a.position - b.position);

    const gaps: Array<[number, number]> = wallOpenings.map(o => {
      const halfT = (o.width / 2) / worldLen;
      return [Math.max(0, o.position - halfT), Math.min(1, o.position + halfT)];
    });

    // Build solid segments around gaps
    const solid: Array<[number, number]> = [];
    let cursor = 0;
    for (const [gStart, gEnd] of gaps) {
      if (gStart > cursor) solid.push([cursor, gStart]);
      cursor = Math.max(cursor, gEnd);
    }
    if (cursor < 1) solid.push([cursor, 1]);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);

    const fillColor = isDark ? '#cccccc' : wall.color;
    const strokeColor = isDark ? '#999999' : '#1a1a1a';

    for (const [segStart, segEnd] of solid) {
      const x = segStart * len;
      const w = (segEnd - segStart) * len;
      if (w < 0.5) continue;
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, -halfThick, w, halfThick * 2);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, -halfThick, w, halfThick * 2);
    }

    ctx.restore();
  }
}
