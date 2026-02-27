import type { Point, Opening } from './plan';

export type ToolType =
  | 'select'
  | 'wall'
  | 'room'
  | 'door'
  | 'window'
  | 'opening'
  | 'furniture'
  | 'dimension'
  | 'text'
  | 'eraser'
  | 'pan';

export type LayerName = 'structure' | 'furniture' | 'annotations';

export interface DrawingState {
  tool: ToolType;
  phase: 'idle' | 'drawing' | 'placing' | 'dragging';
  // Wall drawing:
  chainStart: Point | null;
  // Opening placement:
  pendingOpeningType: Opening['type'] | null;
  pendingOpeningWallId: string | null;
  // Rubber-band selection:
  rubberBandStart: Point | null;
  // Dragging existing elements:
  dragStartWorld: Point | null;
  dragStartPositions: Record<string, Point>; // id → original position
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'midpoint' | 'angle' | 'grid' | 'none';
  targetId?: string; // wallId that was snapped to
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  durationMs: number;
}
