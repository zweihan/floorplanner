import type { BackgroundImage, Viewport } from '../../types/plan';

// Simple in-memory cache so we don't recreate Image objects every frame.
const imageCache = new Map<string, HTMLImageElement>();

function getOrLoadImage(dataUrl: string): HTMLImageElement {
  if (!imageCache.has(dataUrl)) {
    const img = new Image();
    img.src = dataUrl;
    imageCache.set(dataUrl, img);
  }
  return imageCache.get(dataUrl)!;
}

export function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundImage,
  viewport: Viewport,
  ppcm: number
): void {
  if (!bg.visible) return;
  const img = getOrLoadImage(bg.dataUrl);
  if (!img.complete || img.naturalWidth === 0) return;

  const scale = bg.cmPerPx * ppcm * viewport.zoom;
  const screenX = bg.offsetX * ppcm * viewport.zoom + viewport.panX;
  const screenY = bg.offsetY * ppcm * viewport.zoom + viewport.panY;
  const screenW = bg.naturalWidth * scale;
  const screenH = bg.naturalHeight * scale;

  ctx.save();
  ctx.globalAlpha = bg.opacity;
  ctx.drawImage(img, screenX, screenY, screenW, screenH);
  ctx.restore();
}

/** Draw the in-progress calibration line on the canvas. */
export function drawCalibrationLine(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number } | null,
  ghost: { x: number; y: number } | null,
  viewport: Viewport,
  ppcm: number
): void {
  if (!start) return;

  const sx = start.x * ppcm * viewport.zoom + viewport.panX;
  const sy = start.y * ppcm * viewport.zoom + viewport.panY;

  // Start point marker
  ctx.save();
  ctx.strokeStyle = '#f97316'; // orange
  ctx.fillStyle = '#f97316';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();

  if (ghost) {
    const gx = ghost.x * ppcm * viewport.zoom + viewport.panX;
    const gy = ghost.y * ppcm * viewport.zoom + viewport.panY;

    // Dashed line
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    // End point marker
    ctx.beginPath();
    ctx.arc(gx, gy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
