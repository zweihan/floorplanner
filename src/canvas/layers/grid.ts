import type { Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: Viewport,
  gridSize: number,
  ppcm: number,
  settings: UserSettings
): void {
  const isDark = settings.theme === 'dark';
  const zoom = viewport.zoom;
  const cellPx = gridSize * ppcm * zoom;

  // Skip minor dots when they'd be less than 4 px apart
  const drawMinor = cellPx >= 4;
  const majorCellPx = cellPx * 5;

  // First visible grid line in screen coords (wrap into [0, majorCellPx))
  const startX = ((viewport.panX % majorCellPx) + majorCellPx) % majorCellPx;
  const startY = ((viewport.panY % majorCellPx) + majorCellPx) % majorCellPx;

  ctx.save();
  ctx.globalAlpha = 0.4;

  // Minor grid — 1 px dots
  if (drawMinor) {
    ctx.fillStyle = isDark ? '#333333' : '#e0ddd8';
    for (let x = startX % cellPx; x < width; x += cellPx) {
      for (let y = startY % cellPx; y < height; y += cellPx) {
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
  }

  // Major grid — 0.5 px lines
  ctx.strokeStyle = isDark ? '#444444' : '#c8c5c0';
  ctx.lineWidth = 0.5;
  for (let x = startX; x < width; x += majorCellPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = startY; y < height; y += majorCellPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}
