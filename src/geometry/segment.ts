import type { Point } from '../types/plan';
import { dot } from './point';

export function segmentLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle of segment a→b in radians. */
export function segmentAngle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Nearest point on segment [a, b] to point p. */
export function nearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const lenSq = ab.x * ab.x + ab.y * ab.y;
  if (lenSq === 0) return a;
  const t = Math.max(0, Math.min(1, dot({ x: p.x - a.x, y: p.y - a.y }, ab) / lenSq));
  return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

/** Minimum distance from point p to segment [a, b]. */
export function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const nearest = nearestPointOnSegment(p, a, b);
  return Math.hypot(p.x - nearest.x, p.y - nearest.y);
}
