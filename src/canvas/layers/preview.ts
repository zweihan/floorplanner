import type { Point, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen, PPCM } from '../../geometry/transforms';
import { distance } from '../../geometry/point';
import { formatMeasurement } from '../../geometry/units';

/**
 * Draws the ghost wall segment while the wall tool is active.
 * Rendered as a dashed semi-transparent line from the last chain point to ghostPoint.
 */
export function drawPreview(
  ctx: CanvasRenderingContext2D,
  wallChain: Point[],
  ghostPoint: Point | null,
  viewport: Viewport,
  settings: UserSettings,
  defaultThickness: number
): void {
  if (wallChain.length === 0 || ghostPoint === null) return;

  const from = wallChain[wallChain.length - 1];
  const s = worldToScreen(from.x, from.y, viewport, PPCM);
  const e = worldToScreen(ghostPoint.x, ghostPoint.y, viewport, PPCM);

  const halfThick = (defaultThickness / 2) * PPCM * viewport.zoom;
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  const angle = Math.atan2(dy, dx);

  ctx.save();

  // Ghost wall rectangle (dashed)
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = settings.theme === 'dark' ? '#cccccc' : '#2d2d2d';
  ctx.fillRect(0, -halfThick, len, halfThick * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = settings.theme === 'dark' ? '#888888' : '#555555';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, -halfThick, len, halfThick * 2);

  ctx.restore();

  // Length label near midpoint
  const lenCm = distance(from, ghostPoint);
  if (len >= 30) {
    const midX = (s.x + e.x) / 2;
    const midY = (s.y + e.y) / 2;
    const text = formatMeasurement(lenCm, settings.displayUnit);

    ctx.save();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tw = ctx.measureText(text).width + 8;
    const th = 16;
    // Badge background
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = settings.theme === 'dark' ? '#2d2d2d' : '#ffffff';
    ctx.strokeStyle = settings.theme === 'dark' ? '#555' : '#cccccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - tw / 2, midY - th / 2 - halfThick - 8, tw, th, 3);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = settings.theme === 'dark' ? '#e0e0e0' : '#333333';
    ctx.fillText(text, midX, midY - halfThick - 8 + th / 2);
    ctx.restore();
  }
}
