import { useStore } from '../../../store';
import type { ToolCtx, ToolHandler } from './types';

export function createTextTool(ctx: ToolCtx): ToolHandler {
  return {
    onMouseDown(e) {
      ctx.addTextLabel({ position: ctx.rawToWorld(e), text: 'Label', fontSize: 14, color: '#333333', align: 'left' });
      // Immediately open inline editor for the newly placed label
      const freshState = useStore.getState();
      const labels = freshState.activePlanId ? freshState.plans[freshState.activePlanId]?.textLabels : undefined;
      if (labels && labels.length > 0) {
        ctx.setEditingTextLabelId(labels[labels.length - 1].id);
      }
    },

    onMouseMove(e) {
      ctx.setGhostPoint(ctx.rawToWorld(e));
      ctx.onSnapChange(null);
    },
  };
}
