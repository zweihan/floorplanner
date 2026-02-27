import type { Point, Viewport } from '../types/plan';

export const PPCM = 4; // base pixels per centimetre at zoom=1

export function worldToScreen(
  wx: number,
  wy: number,
  camera: Viewport,
  ppcm: number = PPCM
): Point {
  return {
    x: wx * ppcm * camera.zoom + camera.panX,
    y: wy * ppcm * camera.zoom + camera.panY,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Viewport,
  ppcm: number = PPCM
): Point {
  return {
    x: (sx - camera.panX) / (ppcm * camera.zoom),
    y: (sy - camera.panY) / (ppcm * camera.zoom),
  };
}

/** Zoom centred on cursor position (cx, cy) in screen pixels. */
export function applyZoom(
  viewport: Viewport,
  deltaY: number,
  cx: number,
  cy: number
): Viewport {
  const factor = deltaY > 0 ? 1 / 1.1 : 1.1;
  const newZoom = Math.max(0.1, Math.min(8.0, viewport.zoom * factor));
  const newPanX = cx - (cx - viewport.panX) * (newZoom / viewport.zoom);
  const newPanY = cy - (cy - viewport.panY) * (newZoom / viewport.zoom);
  return { zoom: newZoom, panX: newPanX, panY: newPanY };
}
