import type { Point, Viewport } from '../../types/plan';
import type { SnapResult } from '../../types/tools';
import { worldToScreen, PPCM } from '../../geometry/transforms';

/**
 * Renders a visual indicator at the active snap point.
 *   endpoint / midpoint → green circle (r=6)
 *   angle              → green dashed ray from chain start to ghost
 *   grid               → small green crosshair
 */
export function drawSnapIndicators(
  ctx: CanvasRenderingContext2D,
  ghostPoint: Point | null,
  snapResult: SnapResult | null,
  viewport: Viewport
): void {
  if (!ghostPoint) return;

  const s = worldToScreen(ghostPoint.x, ghostPoint.y, viewport, PPCM);
  const type = snapResult?.type ?? 'none';

  ctx.save();
  ctx.strokeStyle = '#22c55e'; // green
  ctx.fillStyle = '#22c55e';
  ctx.lineWidth = 1.5;

  if (type === 'endpoint') {
    // Filled circle with ring
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  } else if (type === 'midpoint') {
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6);
    ctx.lineTo(s.x + 6, s.y);
    ctx.lineTo(s.x, s.y + 6);
    ctx.lineTo(s.x - 6, s.y);
    ctx.closePath();
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  } else if (type === 'angle') {
    // Small crosshair
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(s.x - 8, s.y);
    ctx.lineTo(s.x + 8, s.y);
    ctx.moveTo(s.x, s.y - 8);
    ctx.lineTo(s.x, s.y + 8);
    ctx.stroke();
  } else if (type === 'grid') {
    // Tiny crosshair
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y);
    ctx.lineTo(s.x + 5, s.y);
    ctx.moveTo(s.x, s.y - 5);
    ctx.lineTo(s.x, s.y + 5);
    ctx.stroke();
  }

  ctx.restore();
}
