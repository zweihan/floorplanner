import { distance } from '../../../geometry/point';
import type { ToolCtx, ToolHandler } from './types';

export function createDimensionTool(ctx: ToolCtx): ToolHandler {
  return {
    onMouseDown(e) {
      const { wallChain } = ctx.stateRef.current;
      const lastPt = wallChain.length > 0 ? wallChain[wallChain.length - 1] : null;
      const snap = ctx.getSnapped(e, lastPt);
      ctx.onSnapChange(snap);

      if (wallChain.length === 0) {
        ctx.pushToChain(snap.point);
      } else {
        const from = wallChain[0];
        if (distance(from, snap.point) >= 0.5) {
          ctx.addDimension({ start: from, end: snap.point, offset: 12, overrideText: null });
        }
        ctx.clearChain();
        ctx.setGhostPoint(null);
        ctx.onSnapChange(null);
      }
    },

    onMouseMove(e) {
      const { wallChain } = ctx.stateRef.current;
      const raw = ctx.rawToWorld(e);
      if (wallChain.length > 0) {
        const snap = ctx.getSnapped(e, wallChain[wallChain.length - 1]);
        ctx.setGhostPoint(snap.point);
        ctx.onSnapChange(snap);
      } else {
        ctx.setGhostPoint(raw);
        ctx.onSnapChange(null);
      }
    },
  };
}
