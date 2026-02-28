import type { ToolCtx, ToolHandler } from './types';

export function createCalibrateTool(ctx: ToolCtx): ToolHandler {
  return {
    onMouseDown(e) {
      const { wallChain } = ctx.stateRef.current;
      const world = ctx.rawToWorld(e);
      if (wallChain.length === 0) {
        ctx.pushToChain(world);
      } else {
        ctx.setCalibrationLine({ start: wallChain[0], end: world });
        ctx.clearChain();
        ctx.setGhostPoint(null);
      }
    },

    onMouseMove(e) {
      ctx.setGhostPoint(ctx.rawToWorld(e));
    },
  };
}
