import type { Point, Wall, Viewport } from '../types/plan';
import type { UserSettings } from '../types/settings';
import type { SnapResult } from '../types/tools';
import { distance, midpoint } from './point';

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Snap to nearest wall endpoint within threshold (world cm). */
export function snapToEndpoints(
  cursor: Point,
  walls: Wall[],
  threshold: number
): SnapResult {
  let best: { dist: number; point: Point; wallId: string } | null = null;
  for (const wall of walls) {
    for (const pt of [wall.start, wall.end]) {
      const d = distance(cursor, pt);
      if (d < threshold && (!best || d < best.dist)) {
        best = { dist: d, point: pt, wallId: wall.id };
      }
    }
  }
  if (best) return { point: best.point, type: 'endpoint', targetId: best.wallId };
  return { point: cursor, type: 'none' };
}

/** Snap to nearest wall midpoint within threshold (world cm). */
export function snapToMidpoints(
  cursor: Point,
  walls: Wall[],
  threshold: number
): SnapResult {
  let best: { dist: number; point: Point; wallId: string } | null = null;
  for (const wall of walls) {
    const mid = midpoint(wall.start, wall.end);
    const d = distance(cursor, mid);
    if (d < threshold && (!best || d < best.dist)) {
      best = { dist: d, point: mid, wallId: wall.id };
    }
  }
  if (best) return { point: best.point, type: 'midpoint', targetId: best.wallId };
  return { point: cursor, type: 'none' };
}

/**
 * Snap cursor to the nearest of the given angles (degrees) from start.
 * The cursor is projected onto the nearest ray at the given angle.
 */
export function snapToAngle(
  start: Point,
  cursor: Point,
  anglesDeg: number[]
): Point {
  const dx = cursor.x - start.x;
  const dy = cursor.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return cursor; // too close to snap
  const currentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const nearest = anglesDeg.reduce(
    (best, a) => {
      let diff = ((currentAngle - a) % 360 + 360) % 360;
      if (diff > 180) diff -= 360;
      return Math.abs(diff) < Math.abs(best.diff) ? { a, diff } : best;
    },
    { a: anglesDeg[0], diff: 360 }
  ).a;
  const rad = (nearest * Math.PI) / 180;
  return { x: start.x + dist * Math.cos(rad), y: start.y + dist * Math.sin(rad) };
}

/**
 * Master snapping function.
 * Priority: endpoint → midpoint → angle → grid → none.
 * chainStart: start of the current wall segment (last committed chain point).
 *             Used for angle snapping. Pass null when not drawing a wall.
 */
export function applySnapping(
  cursor: Point,
  walls: Wall[],
  settings: UserSettings,
  viewport: Viewport,
  ppcm: number,
  chainStart: Point | null = null,
  shiftHeld = false,
  gridSize?: number  // per-plan grid size; falls back to settings.defaultGridSize
): SnapResult {
  const threshold = 12 / (ppcm * viewport.zoom); // 12 screen px → world cm

  if (settings.snapToEndpoint) {
    const r = snapToEndpoints(cursor, walls, threshold);
    if (r.type !== 'none') return r;
  }

  if (settings.snapToMidpoint) {
    const r = snapToMidpoints(cursor, walls, threshold);
    if (r.type !== 'none') return r;
  }

  if (settings.snapToAngle && chainStart) {
    const angles = shiftHeld
      ? [0, 90, 180, 270]
      : [0, 45, 90, 135, 180, 225, 270, 315];
    const snapped = snapToAngle(chainStart, cursor, angles);
    if (distance(snapped, cursor) < threshold) {
      return { point: snapped, type: 'angle' };
    }
  }

  if (settings.snapToGrid) {
    const g = gridSize ?? settings.defaultGridSize;
    return {
      point: {
        x: snapToGrid(cursor.x, g),
        y: snapToGrid(cursor.y, g),
      },
      type: 'grid',
    };
  }

  return { point: cursor, type: 'none' };
}
