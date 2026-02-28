import { distance } from '../../../geometry/point';
import type { ToolCtx, ToolHandler } from './types';

export function createWallTool(ctx: ToolCtx): ToolHandler {
  let wallsInChain = 0;

  return {
    onMouseDown(e) {
      const { wallChain } = ctx.stateRef.current;
      const lastPt = wallChain.length > 0 ? wallChain[wallChain.length - 1] : null;
      const snap = ctx.getSnapped(e, lastPt);
      ctx.onSnapChange(snap);

      if (wallChain.length === 0) {
        ctx.pushToChain(snap.point);
        wallsInChain = 0;
      } else {
        const from = wallChain[wallChain.length - 1];
        if (distance(from, snap.point) < 0.5) return;

        if (wallChain.length >= 2 && distance(snap.point, wallChain[0]) < 1.0) {
          ctx.addWall(from, wallChain[0]);
          ctx.clearChain();
          ctx.onSnapChange(null);
          wallsInChain = 0;
        } else {
          ctx.addWall(from, snap.point);
          ctx.pushToChain(snap.point);
          wallsInChain++;
        }
      }
    },

    onMouseMove(e) {
      const { wallChain } = ctx.stateRef.current;
      if (wallChain.length === 0) {
        ctx.setGhostPoint(ctx.rawToWorld(e));
        ctx.onSnapChange(null);
        return;
      }
      const lastPt = wallChain[wallChain.length - 1];
      const snap = ctx.getSnapped(e, lastPt);
      ctx.setGhostPoint(snap.point);
      ctx.onSnapChange(snap);
    },

    onDblClick() {
      if (wallsInChain > 0) {
        ctx.undo();
        wallsInChain--;
      }
      ctx.clearChain();
      ctx.onSnapChange(null);
    },

    onContextMenu() {
      ctx.clearChain();
      ctx.onSnapChange(null);
    },
  };
}
