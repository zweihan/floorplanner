import type { ToolCtx, ToolHandler } from './types';

export function createOpeningTool(ctx: ToolCtx): ToolHandler {
  return {
    onMouseDown(e) {
      const { activeTool } = ctx.stateRef.current;
      const target = ctx.findOpeningTarget(e);
      if (!target) return;
      const isDoor = activeTool === 'door';
      const isOpening = activeTool === 'opening';
      ctx.addOpening({
        wallId: target.wallId,
        type: isDoor ? 'door' : isOpening ? 'opening' : 'window',
        position: target.t,
        width: isDoor || isOpening ? 90 : 100,
        height: isDoor ? 210 : isOpening ? 244 : 100,
        sillHeight: isDoor || isOpening ? 0 : 90,
        swingDirection: 'inward',
        openAngle: 90,
        flipSide: false,
      });
      ctx.onOpeningGhostChange(null);
    },

    onMouseMove(e) {
      const target = ctx.findOpeningTarget(e);
      ctx.onOpeningGhostChange(target);
      ctx.setGhostPoint(ctx.rawToWorld(e));
    },

    onMouseLeave() {
      ctx.onOpeningGhostChange(null);
      ctx.setGhostPoint(null);
      ctx.onSnapChange(null);
    },
  };
}
