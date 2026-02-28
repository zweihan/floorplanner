import type { Point, Plan, Viewport, Opening, Room, FurnitureItem, DimensionLine, TextLabel } from '../../../types/plan';
import type { SnapResult } from '../../../types/tools';
import type { OpeningGhost } from '../../layers/openings';
import type { UserSettings } from '../../../types/settings';

export interface StateSnapshot {
  activeTool: string;
  wallChain: Point[];
  settings: UserSettings;
  plans: Record<string, Plan>;
  activePlanId: string | null;
  selectedIds: string[];
  pendingFurnitureTemplateId: string | null;
}

/** Shared context passed to every tool factory. */
export interface ToolCtx {
  stateRef: { current: StateSnapshot };
  getViewport(): Viewport;
  rawToWorld(e: MouseEvent): Point;
  getSnapped(e: MouseEvent, chainStart: Point | null): SnapResult;
  getHitThreshold(): number;
  findOpeningTarget(e: MouseEvent): OpeningGhost | null;
  // Store actions
  addWall(start: Point, end: Point): void;
  addRoom(room: Omit<Room, 'id'>): void;
  addOpening(opening: Omit<Opening, 'id'>): void;
  addFurniture(item: Omit<FurnitureItem, 'id'>): void;
  updateFurniture(id: string, changes: Partial<FurnitureItem>): void;
  pushToChain(pt: Point): void;
  clearChain(): void;
  setGhostPoint(pt: Point | null): void;
  undo(): void;
  setSelectedIds(ids: string[]): void;
  moveElements(ids: string[], dx: number, dy: number): void;
  setActivePlanNoHistory(plan: Plan): void;
  updateWallEndpoints(updates: Array<{ id: string; endpoint: 'start' | 'end'; position: Point }>): void;
  setCalibrationLine(line: { start: Point; end: Point } | null): void;
  addDimension(dim: Omit<DimensionLine, 'id'>): void;
  addTextLabel(label: Omit<TextLabel, 'id'>): void;
  deleteElements(ids: string[]): void;
  setEditingTextLabelId(id: string | null): void;
  // Callbacks
  onSnapChange(snap: SnapResult | null): void;
  onRubberBandChange(rect: { x1: number; y1: number; x2: number; y2: number } | null): void;
  onOpeningGhostChange(ghost: OpeningGhost | null): void;
}

export interface ToolHandler {
  onMouseDown?(e: MouseEvent): void;
  onMouseMove?(e: MouseEvent): void;
  onMouseUp?(e: MouseEvent): void;
  onDblClick?(e: MouseEvent): void;
  onContextMenu?(e: MouseEvent): void;
  onMouseLeave?(): void;
}
