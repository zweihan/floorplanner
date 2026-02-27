import type { Plan, Viewport, Point } from '../types/plan';
import type { UserSettings } from '../types/settings';
import type { LayerName, DrawingState, SnapResult } from '../types/tools';
import { worldToScreen } from '../geometry/transforms';
import { drawBackground } from './layers/background';
import { drawGrid } from './layers/grid';
import { drawWalls } from './layers/walls';
import { drawWallLabels } from './layers/labels';
import { drawPreview } from './layers/preview';
import { drawSnapIndicators } from './layers/snapIndicators';
import { drawSelection } from './layers/selection';

export interface RenderState {
  plan: Plan;
  viewport: Viewport;
  settings: UserSettings;
  selectedIds: string[];
  hoveredId: string | null;
  ghostPoint: Point | null;
  wallChain: Point[];
  drawingState: DrawingState | null;
  showGrid: boolean;
  layers: Record<LayerName, { visible: boolean; locked: boolean }>;
  pendingFurnitureTemplateId: string | null;
  snapResult: SnapResult | null;
  rubberBandRect: { x1: number; y1: number; x2: number; y2: number } | null;
  ppcm: number; // always 4
}

/**
 * Main render entry point. Redraws the full canvas from scratch each frame.
 * Layer order follows spec §8.1 (bottom to top).
 */
export function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
): void {
  const { plan, viewport, settings, showGrid, layers, wallChain, ghostPoint, snapResult, selectedIds } = state;

  // 1. Background
  drawBackground(ctx, width, height, settings);

  // 2. Grid
  if (showGrid) {
    drawGrid(ctx, width, height, viewport, plan.gridSize, state.ppcm, settings);
  }

  // 3. Room fills — Phase 2
  // 4. Furniture — Phase 3

  // 5–6. Walls
  if (layers.structure.visible) {
    drawWalls(ctx, plan.walls, viewport, settings, state.ppcm);
  }

  // 7. Openings — Phase 3
  // 8. Dimension lines — Phase 3
  // 9. Text labels — Phase 3
  // 10. Room labels — Phase 2

  // 10. Wall length labels (shown when showDimensions is on)
  if (settings.showDimensions && layers.structure.visible) {
    drawWallLabels(ctx, plan.walls, viewport, settings);
  }

  // 11. Selection UI
  drawSelection(ctx, plan, selectedIds, viewport, settings, state.ppcm);

  // 12. Tool preview (ghost wall)
  drawPreview(ctx, wallChain, ghostPoint, viewport, settings, settings.defaultWallThickness);

  // 12b. Rubber-band selection rect
  if (state.rubberBandRect) {
    const r = state.rubberBandRect;
    const s1 = worldToScreen(r.x1, r.y1, viewport, state.ppcm);
    const s2 = worldToScreen(r.x2, r.y2, viewport, state.ppcm);
    const rx = Math.min(s1.x, s2.x);
    const ry = Math.min(s1.y, s2.y);
    const rw = Math.abs(s2.x - s1.x);
    const rh = Math.abs(s2.y - s1.y);
    ctx.save();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  // 13. Snap indicators
  drawSnapIndicators(ctx, ghostPoint, snapResult, viewport);
}
