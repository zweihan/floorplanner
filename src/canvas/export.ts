import type { Plan } from '../types/plan';
import type { UserSettings } from '../types/settings';
import { PPCM } from '../geometry/transforms';
import { drawBackground } from './layers/background';
import { drawRooms } from './layers/rooms';
import { drawFurniture } from './layers/furniture';
import { drawWalls } from './layers/walls';
import { drawOpenings } from './layers/openings';
import { drawDimensions } from './layers/dimensions';
import { drawTextLabels } from './layers/textLabels';
import { drawWallLabels } from './layers/labels';

const EXPORT_PADDING_CM = 20; // padding around content

/** Compute tight bounding box of all plan elements (in cm). Falls back to plan dims. */
function computeExportBounds(plan: Plan): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];

  plan.walls.forEach(w => {
    xs.push(w.start.x, w.end.x);
    ys.push(w.start.y, w.end.y);
  });
  plan.rooms.forEach(r => {
    r.points.forEach(p => { xs.push(p.x); ys.push(p.y); });
  });
  plan.furniture.forEach(f => {
    xs.push(f.position.x - f.width / 2, f.position.x + f.width / 2);
    ys.push(f.position.y - f.depth / 2, f.position.y + f.depth / 2);
  });
  plan.dimensions.forEach(d => {
    xs.push(d.start.x, d.end.x);
    ys.push(d.start.y, d.end.y);
  });
  plan.textLabels.forEach(t => {
    xs.push(t.position.x);
    ys.push(t.position.y);
  });

  if (xs.length === 0) {
    return { minX: 0, minY: 0, maxX: plan.width, maxY: plan.height };
  }

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/**
 * Render the plan to an off-screen canvas and trigger a PNG download.
 * @param plan   The plan to export
 * @param settings  User settings (for theme, dimensions etc.)
 * @param scale  1 | 2 | 4 — pixel density multiplier
 */
export function exportPNG(plan: Plan, settings: UserSettings, scale: 1 | 2 | 4 = 1): void {
  const bounds = computeExportBounds(plan);
  const contentW = bounds.maxX - bounds.minX + EXPORT_PADDING_CM * 2;
  const contentH = bounds.maxY - bounds.minY + EXPORT_PADDING_CM * 2;

  const pxW = Math.round(contentW * PPCM * scale);
  const pxH = Math.round(contentH * PPCM * scale);

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Viewport that maps world coords to the export canvas
  const viewport = {
    panX: (EXPORT_PADDING_CM - bounds.minX) * PPCM * scale,
    panY: (EXPORT_PADDING_CM - bounds.minY) * PPCM * scale,
    zoom: scale,
  };

  const exportSettings: UserSettings = { ...settings, theme: 'light' };

  // Render layers (no grid, no UI elements)
  drawBackground(ctx, pxW, pxH, exportSettings);
  drawRooms(ctx, plan.rooms, viewport, exportSettings, PPCM);
  drawFurniture(ctx, plan.furniture, viewport, exportSettings, PPCM);
  drawWalls(ctx, plan.walls, plan.openings, viewport, exportSettings, PPCM);
  drawOpenings(ctx, plan.walls, plan.openings, viewport, exportSettings, PPCM);
  drawDimensions(ctx, plan.dimensions, viewport, exportSettings, PPCM);
  drawTextLabels(ctx, plan.textLabels, viewport, PPCM, null);
  if (exportSettings.showDimensions) {
    drawWallLabels(ctx, plan.walls, viewport, exportSettings);
  }

  // Download
  const safeFileName = plan.name.replace(/[^a-z0-9_\-]/gi, '_') || 'floorplan';
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${safeFileName}_${scale}x.png`;
  a.click();
}
