import type { DimensionLine, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';
import { distance } from '../../geometry/point';
import { formatMeasurement } from '../../geometry/units';
import type { DisplayUnit } from '../../types/plan';

const ARROW_SIZE = 8;    // px — arrowhead length
const EXT_OVERSHOOT = 4; // px — extension lines extend this far past the dimension line
const LABEL_OFFSET = 5;  // px — gap between dimension line and text

function drawArrow(
  ctx: CanvasRenderingContext2D,
  tipX: number, tipY: number,
  dirX: number, dirY: number // unit vector pointing FROM tip INTO the main line
): void {
  const perpX = -dirY;
  const perpY = dirX;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + dirX * ARROW_SIZE + perpX * ARROW_SIZE * 0.35,
             tipY + dirY * ARROW_SIZE + perpY * ARROW_SIZE * 0.35);
  ctx.lineTo(tipX + dirX * ARROW_SIZE - perpX * ARROW_SIZE * 0.35,
             tipY + dirY * ARROW_SIZE - perpY * ARROW_SIZE * 0.35);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws all dimension lines for the plan.
 */
export function drawDimensions(
  ctx: CanvasRenderingContext2D,
  dimensions: DimensionLine[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  if (dimensions.length === 0) return;
  const unit = (settings.displayUnit ?? 'cm') as DisplayUnit;
  const isDark = settings.theme === 'dark';
  const lineColor = isDark ? '#93c5fd' : '#2563eb';
  const textColor = isDark ? '#dbeafe' : '#1e3a8a';

  ctx.save();

  for (const dim of dimensions) {
    _drawOneDimension(ctx, dim, viewport, ppcm, unit, lineColor, textColor, false);
  }

  ctx.restore();
}

/** Draw a single dimension line (shared by drawDimensions and drawDimensionGhost). */
function _drawOneDimension(
  ctx: CanvasRenderingContext2D,
  dim: DimensionLine,
  viewport: Viewport,
  ppcm: number,
  unit: DisplayUnit,
  lineColor: string,
  textColor: string,
  isGhost: boolean
): void {
  const sp1 = worldToScreen(dim.start.x, dim.start.y, viewport, ppcm);
  const sp2 = worldToScreen(dim.end.x, dim.end.y, viewport, ppcm);

  const sdx = sp2.x - sp1.x;
  const sdy = sp2.y - sp1.y;
  const screenLen = Math.hypot(sdx, sdy);
  if (screenLen < 2) return;

  const sux = sdx / screenLen; // unit along dimension
  const suy = sdy / screenLen;

  // Perpendicular in screen space (left of P1→P2)
  const snx = -suy;
  const sny = sux;

  // Offset in screen pixels
  const offsetPx = dim.offset * ppcm * viewport.zoom;

  // Dimension line endpoints Q1, Q2 (at offset from P1, P2)
  const q1x = sp1.x + snx * offsetPx;
  const q1y = sp1.y + sny * offsetPx;
  const q2x = sp2.x + snx * offsetPx;
  const q2y = sp2.y + sny * offsetPx;

  // Check screen length of dimension line (should be same as screenLen)
  if (screenLen < 40 && !isGhost) return;

  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.lineWidth = isGhost ? 1 : 1.5;
  if (isGhost) ctx.setLineDash([5, 4]);

  // Extension lines (P1→Q1 and P2→Q2, extended a bit past Q)
  const signOffsetX = offsetPx !== 0 ? snx * Math.sign(offsetPx) : snx;
  const signOffsetY = offsetPx !== 0 ? sny * Math.sign(offsetPx) : sny;

  ctx.beginPath();
  ctx.moveTo(sp1.x + signOffsetX * 2, sp1.y + signOffsetY * 2); // start slightly away from ref point
  ctx.lineTo(q1x + signOffsetX * EXT_OVERSHOOT, q1y + signOffsetY * EXT_OVERSHOOT);
  ctx.moveTo(sp2.x + signOffsetX * 2, sp2.y + signOffsetY * 2);
  ctx.lineTo(q2x + signOffsetX * EXT_OVERSHOOT, q2y + signOffsetY * EXT_OVERSHOOT);
  ctx.stroke();

  // Main dimension line
  ctx.beginPath();
  ctx.moveTo(q1x, q1y);
  ctx.lineTo(q2x, q2y);
  ctx.stroke();

  ctx.setLineDash([]);

  // Arrowheads (only when line is long enough)
  if (screenLen >= 40 || isGhost) {
    drawArrow(ctx, q1x, q1y, sux, suy);   // arrow at Q1, pointing toward Q2
    drawArrow(ctx, q2x, q2y, -sux, -suy); // arrow at Q2, pointing toward Q1
  }

  // Label
  const labelText = dim.overrideText ?? formatMeasurement(distance(dim.start, dim.end), unit);
  const midX = (q1x + q2x) / 2;
  const midY = (q1y + q2y) / 2;

  const angle = Math.atan2(sdy, sdx);
  const shouldFlip = angle > Math.PI / 2 || angle < -Math.PI / 2;

  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const tw = ctx.measureText(labelText).width + 6;
  const th = 12;

  ctx.translate(midX, midY);
  ctx.rotate(shouldFlip ? angle + Math.PI : angle);

  // Background pill for readability
  const bgAlpha = isGhost ? 0.6 : 0.9;
  ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
  ctx.fillRect(-tw / 2, -(LABEL_OFFSET + th), tw, th);

  ctx.fillStyle = textColor;
  ctx.fillText(labelText, 0, -LABEL_OFFSET);
  ctx.restore();
}

/**
 * Draw a ghost dimension line preview (from wallChain[0] to ghostPoint).
 */
export function drawDimensionGhost(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  viewport: Viewport,
  ppcm: number
): void {
  const unit: DisplayUnit = 'cm';
  ctx.save();
  _drawOneDimension(
    ctx,
    { id: '', start, end, offset: 12, overrideText: null },
    viewport, ppcm, unit,
    'rgba(37,99,235,0.6)', 'rgba(30,58,138,0.8)',
    true
  );
  ctx.restore();
}
