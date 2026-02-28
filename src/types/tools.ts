import type { Point } from './plan';

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
  | 'pan'
  | 'calibrate';

export type LayerName = 'structure' | 'furniture' | 'annotations';

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
