import type { Room, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';
import { shoelaceArea, polygonCentroid } from '../../geometry/polygon';

function formatArea(areaCm2: number, unit: UserSettings['displayUnit']): string {
  if (unit === 'm') return `${(areaCm2 / 10000).toFixed(2)} m²`;
  if (unit === 'ft') return `${(areaCm2 / 929.03).toFixed(1)} ft²`;
  return `${Math.round(areaCm2)} cm²`;
}

export function drawRooms(
  ctx: CanvasRenderingContext2D,
  rooms: Room[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  const isDark = settings.theme === 'dark';

  for (const room of rooms) {
    if (room.points.length < 3) continue;

    const screenPts = room.points.map(p => worldToScreen(p.x, p.y, viewport, ppcm));

    // ── Filled polygon ────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
      ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.closePath();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = isDark ? adjustColorForDark(room.color) : room.color;
    ctx.fill();

    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = isDark ? adjustColorForDark(room.color) : room.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();

    ctx.restore();

    // ── Labels ────────────────────────────────────────────────────────────────
    if (!room.showLabel && !room.showArea) continue;

    // Compute diagonal px to skip labels on tiny rooms
    const minX = Math.min(...screenPts.map(p => p.x));
    const maxX = Math.max(...screenPts.map(p => p.x));
    const minY = Math.min(...screenPts.map(p => p.y));
    const maxY = Math.max(...screenPts.map(p => p.y));
    if (Math.hypot(maxX - minX, maxY - minY) < 40) continue;

    const labelScrn = worldToScreen(room.labelPosition.x, room.labelPosition.y, viewport, ppcm);
    const hasName = room.showLabel && room.name.length > 0;
    const hasArea = room.showArea;
    const yOff = hasName && hasArea ? 8 : 0;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (hasName) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = isDark ? '#e0e0e0' : '#333333';
      ctx.fillText(room.name, labelScrn.x, labelScrn.y - yOff);
    }

    if (hasArea) {
      const areaCm2 = shoelaceArea(room.points);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = isDark ? '#aaaaaa' : '#666666';
      ctx.fillText(formatArea(areaCm2, settings.displayUnit), labelScrn.x, labelScrn.y + (hasName ? yOff : 0));
    }

    ctx.restore();
  }
}

/** Draw a room polygon that's currently being drawn (interactive preview). */
export function drawRoomPreview(
  ctx: CanvasRenderingContext2D,
  chain: { x: number; y: number }[],
  ghostPoint: { x: number; y: number } | null,
  viewport: Viewport,
  ppcm: number
): void {
  if (chain.length === 0) return;

  const screenPts = chain.map(p => worldToScreen(p.x, p.y, viewport, ppcm));
  const ghost = ghostPoint ? worldToScreen(ghostPoint.x, ghostPoint.y, viewport, ppcm) : null;
  const firstPt = screenPts[0];

  ctx.save();

  // Lines connecting committed vertices
  if (screenPts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    for (let i = 1; i < screenPts.length; i++) {
      ctx.lineTo(screenPts[i].x, screenPts[i].y);
    }
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.8;
    ctx.stroke();
  }

  // Ghost line from last vertex to cursor
  if (ghost) {
    const last = screenPts[screenPts.length - 1];
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(ghost.x, ghost.y);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.5;
    ctx.stroke();
  }

  // Vertex dots
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  for (let i = 0; i < screenPts.length; i++) {
    ctx.beginPath();
    ctx.arc(screenPts[i].x, screenPts[i].y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // First-vertex closing indicator (larger circle when near)
  if (chain.length >= 3 && ghost) {
    const dx = ghost.x - firstPt.x;
    const dy = ghost.y - firstPt.y;
    const dist = Math.hypot(dx, dy);
    const closeRadius = dist < 12 ? 10 : 6;
    ctx.beginPath();
    ctx.arc(firstPt.x, firstPt.y, closeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function adjustColorForDark(hex: string): string {
  // Lighten pastel room colors for dark backgrounds
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, Math.round(r * 0.6 + 100));
  const lg = Math.min(255, Math.round(g * 0.6 + 100));
  const lb = Math.min(255, Math.round(b * 0.6 + 100));
  return `rgb(${lr},${lg},${lb})`;
}

// Re-export for convenience
export { polygonCentroid, shoelaceArea };
