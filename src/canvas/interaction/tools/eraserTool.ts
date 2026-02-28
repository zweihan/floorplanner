import { hitTestPlan } from '../../../geometry/hitTest';
import type { ToolCtx, ToolHandler } from './types';

export function createEraserTool(ctx: ToolCtx): ToolHandler {
  let eraserIds = new Set<string>();
  let dragging = false;

  function commitErase() {
    if (eraserIds.size > 0) {
      ctx.deleteElements([...eraserIds]);
      eraserIds = new Set();
    }
    dragging = false;
  }

  return {
    onMouseDown(e) {
      const { plans, activePlanId } = ctx.stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return;
      const world = ctx.rawToWorld(e);
      const hit = hitTestPlan(plan, world, ctx.getHitThreshold());
      if (hit) {
        eraserIds = new Set([hit]);
        dragging = true;
      }
    },

    onMouseMove(e) {
      ctx.setGhostPoint(ctx.rawToWorld(e));
      if (!dragging) return;
      const { plans, activePlanId } = ctx.stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return;
      const hit = hitTestPlan(plan, ctx.rawToWorld(e), ctx.getHitThreshold());
      if (hit && !eraserIds.has(hit)) eraserIds.add(hit);
    },

    onMouseUp() {
      if (dragging) commitErase();
    },

    onMouseLeave() {
      if (dragging) commitErase();
      ctx.setGhostPoint(null);
      ctx.onSnapChange(null);
    },
  };
}
