import { distance } from '../../../geometry/point';
import { polygonCentroid } from '../../../geometry/polygon';
import { ROOM_COLORS } from '../../../data/roomColors';
import { useStore } from '../../../store';
import type { Point } from '../../../types/plan';
import type { ToolCtx, ToolHandler } from './types';

export function createRoomTool(ctx: ToolCtx): ToolHandler {
  function commitRoom(chain: Point[]) {
    if (chain.length < 3) { ctx.clearChain(); return; }
    const { plans, activePlanId } = ctx.stateRef.current;
    const roomCount = activePlanId ? (plans[activePlanId]?.rooms.length ?? 0) : 0;
    const color = ROOM_COLORS[roomCount % ROOM_COLORS.length];
    ctx.addRoom({
      name: `Room ${roomCount + 1}`,
      wallIds: [],
      points: chain,
      color,
      area: 0,
      labelPosition: polygonCentroid(chain),
      showArea: true,
      showLabel: true,
    });
    ctx.clearChain();
    ctx.setGhostPoint(null);
    ctx.onSnapChange(null);
  }

  return {
    onMouseDown(e) {
      const { wallChain } = ctx.stateRef.current;
      const snap = ctx.getSnapped(e, wallChain.length > 0 ? wallChain[wallChain.length - 1] : null);
      ctx.onSnapChange(snap);

      if (wallChain.length === 0) {
        ctx.pushToChain(snap.point);
      } else {
        const threshold = ctx.getHitThreshold() * 2;
        if (wallChain.length >= 3 && distance(snap.point, wallChain[0]) < threshold) {
          commitRoom(wallChain);
        } else if (distance(snap.point, wallChain[wallChain.length - 1]) > 0.5) {
          ctx.pushToChain(snap.point);
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
      // Read chain directly from store — stateRef may lag behind the mousedown push
      const chain = useStore.getState().wallChain;
      // Remove the last vertex added by this dblclick's mousedown (duplicate)
      const pts = chain.length >= 2 ? chain.slice(0, -1) : chain;
      commitRoom(pts);
    },

    onContextMenu() {
      ctx.clearChain();
      ctx.onSnapChange(null);
    },
  };
}
