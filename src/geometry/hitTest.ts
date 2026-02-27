import type { Plan, Wall, Room, Opening, FurnitureItem, DimensionLine, TextLabel, Point } from '../types/plan';
import { distance, midpoint } from './point';
import { pointToSegmentDist } from './segment';

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ─── Per-type hit tests ──────────────────────────────────────────────────────

/**
 * Projects p onto the wall centreline.
 * Returns t ∈ [0, 1] (parametric position) when p is within threshold of the
 * wall centreline AND within the wall's bounds, otherwise null.
 */
export function hitTestWallForOpening(wall: Wall, p: Point, threshold: number): number | null {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1) return null;
  const t = ((p.x - wall.start.x) * dx + (p.y - wall.start.y) * dy) / (wallLen * wallLen);
  if (t < 0 || t > 1) return null;
  const projX = wall.start.x + t * dx;
  const projY = wall.start.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY) <= threshold ? t : null;
}

export function hitTestWall(wall: Wall, p: Point, threshold: number): boolean {
  return pointToSegmentDist(p, wall.start, wall.end) <= wall.thickness / 2 + threshold;
}

/** Returns 'start' or 'end' if p is within threshold of that endpoint, else null. */
export function hitTestWallEndpoint(wall: Wall, p: Point, threshold: number): 'start' | 'end' | null {
  if (distance(p, wall.start) <= threshold) return 'start';
  if (distance(p, wall.end) <= threshold) return 'end';
  return null;
}

export function hitTestWallMidpoint(wall: Wall, p: Point, threshold: number): boolean {
  return distance(p, midpoint(wall.start, wall.end)) <= threshold;
}

export function hitTestRoom(room: Room, p: Point): boolean {
  const poly = room.points;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function hitTestFurniture(item: FurnitureItem, p: Point): boolean {
  const cos = Math.cos(-item.rotation * Math.PI / 180);
  const sin = Math.sin(-item.rotation * Math.PI / 180);
  const dx = p.x - item.position.x;
  const dy = p.y - item.position.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(localX) <= item.width / 2 && Math.abs(localY) <= item.depth / 2;
}

export function hitTestOpening(opening: Opening, walls: Wall[], p: Point): boolean {
  const wall = walls.find(w => w.id === opening.wallId);
  if (!wall) return false;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const wallLen = Math.hypot(dx, dy);
  if (wallLen < 1) return false;
  const ux = dx / wallLen;
  const uy = dy / wallLen;
  const cx = wall.start.x + ux * wallLen * opening.position;
  const cy = wall.start.y + uy * wallLen * opening.position;
  const relX = p.x - cx;
  const relY = p.y - cy;
  const localX = relX * ux + relY * uy;
  const localY = -relX * uy + relY * ux;
  return Math.abs(localX) <= opening.width / 2 && Math.abs(localY) <= wall.thickness / 2 + 2;
}

export function hitTestDimension(dim: DimensionLine, p: Point, threshold: number): boolean {
  return pointToSegmentDist(p, dim.start, dim.end) <= threshold;
}

export function hitTestTextLabel(label: TextLabel, p: Point): boolean {
  const halfW = Math.max(label.text.length * label.fontSize * 0.35, 5);
  const halfH = label.fontSize * 0.6;
  return Math.abs(p.x - label.position.x) <= halfW && Math.abs(p.y - label.position.y) <= halfH;
}

// ─── Bounding boxes ──────────────────────────────────────────────────────────

export function wallBBox(wall: Wall): BBox {
  const half = wall.thickness / 2;
  return {
    minX: Math.min(wall.start.x, wall.end.x) - half,
    minY: Math.min(wall.start.y, wall.end.y) - half,
    maxX: Math.max(wall.start.x, wall.end.x) + half,
    maxY: Math.max(wall.start.y, wall.end.y) + half,
  };
}

export function furnitureBBox(item: FurnitureItem): BBox {
  const hw = item.width / 2;
  const hd = item.depth / 2;
  const cos = Math.cos(item.rotation * Math.PI / 180);
  const sin = Math.sin(item.rotation * Math.PI / 180);
  // AABB of rotated corners
  const xs = [
    item.position.x + cos * hw - sin * hd,
    item.position.x + cos * hw + sin * hd,
    item.position.x - cos * hw - sin * hd,
    item.position.x - cos * hw + sin * hd,
  ];
  const ys = [
    item.position.y + sin * hw + cos * hd,
    item.position.y + sin * hw - cos * hd,
    item.position.y - sin * hw + cos * hd,
    item.position.y - sin * hw - cos * hd,
  ];
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// ─── Master hit test (reverse render order = topmost first) ─────────────────

export function hitTestPlan(plan: Plan, p: Point, threshold: number): string | null {
  for (let i = plan.textLabels.length - 1; i >= 0; i--) {
    if (hitTestTextLabel(plan.textLabels[i], p)) return plan.textLabels[i].id;
  }
  for (let i = plan.dimensions.length - 1; i >= 0; i--) {
    if (hitTestDimension(plan.dimensions[i], p, threshold)) return plan.dimensions[i].id;
  }
  for (let i = plan.furniture.length - 1; i >= 0; i--) {
    if (hitTestFurniture(plan.furniture[i], p)) return plan.furniture[i].id;
  }
  for (let i = plan.openings.length - 1; i >= 0; i--) {
    if (hitTestOpening(plan.openings[i], plan.walls, p)) return plan.openings[i].id;
  }
  for (let i = plan.walls.length - 1; i >= 0; i--) {
    if (hitTestWall(plan.walls[i], p, threshold)) return plan.walls[i].id;
  }
  for (let i = plan.rooms.length - 1; i >= 0; i--) {
    if (hitTestRoom(plan.rooms[i], p)) return plan.rooms[i].id;
  }
  return null;
}

/** Returns ids of all elements whose bounding boxes overlap the given rectangle. */
export function hitTestPlanInRect(plan: Plan, rect: BBox): string[] {
  const ids: string[] = [];
  for (const wall of plan.walls) {
    if (bboxesOverlap(wallBBox(wall), rect)) ids.push(wall.id);
  }
  for (const room of plan.rooms) {
    const bbox: BBox = {
      minX: Math.min(...room.points.map(p => p.x)),
      minY: Math.min(...room.points.map(p => p.y)),
      maxX: Math.max(...room.points.map(p => p.x)),
      maxY: Math.max(...room.points.map(p => p.y)),
    };
    if (bboxesOverlap(bbox, rect)) ids.push(room.id);
  }
  for (const item of plan.furniture) {
    if (bboxesOverlap(furnitureBBox(item), rect)) ids.push(item.id);
  }
  for (const opening of plan.openings) {
    const wall = plan.walls.find(w => w.id === opening.wallId);
    if (!wall) continue;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLen = Math.hypot(dx, dy);
    if (wallLen < 1) continue;
    const ux = dx / wallLen;
    const uy = dy / wallLen;
    const cx = wall.start.x + ux * wallLen * opening.position;
    const cy = wall.start.y + uy * wallLen * opening.position;
    const hw = opening.width / 2;
    const ht = wall.thickness / 2;
    const corners = [
      { x: cx + ux * hw - uy * ht, y: cy + uy * hw + ux * ht },
      { x: cx + ux * hw + uy * ht, y: cy + uy * hw - ux * ht },
      { x: cx - ux * hw - uy * ht, y: cy - uy * hw + ux * ht },
      { x: cx - ux * hw + uy * ht, y: cy - uy * hw - ux * ht },
    ];
    const bbox: BBox = {
      minX: Math.min(...corners.map(c => c.x)),
      minY: Math.min(...corners.map(c => c.y)),
      maxX: Math.max(...corners.map(c => c.x)),
      maxY: Math.max(...corners.map(c => c.y)),
    };
    if (bboxesOverlap(bbox, rect)) ids.push(opening.id);
  }
  for (const dim of plan.dimensions) {
    const bbox: BBox = {
      minX: Math.min(dim.start.x, dim.end.x),
      minY: Math.min(dim.start.y, dim.end.y),
      maxX: Math.max(dim.start.x, dim.end.x),
      maxY: Math.max(dim.start.y, dim.end.y),
    };
    if (bboxesOverlap(bbox, rect)) ids.push(dim.id);
  }
  for (const label of plan.textLabels) {
    const halfW = Math.max(label.text.length * label.fontSize * 0.35, 5);
    const halfH = label.fontSize * 0.6;
    const bbox: BBox = {
      minX: label.position.x - halfW,
      minY: label.position.y - halfH,
      maxX: label.position.x + halfW,
      maxY: label.position.y + halfH,
    };
    if (bboxesOverlap(bbox, rect)) ids.push(label.id);
  }
  return ids;
}
