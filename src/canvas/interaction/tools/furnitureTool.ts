import { getTemplate } from '../../../data/furnitureTemplates';
import type { ToolCtx, ToolHandler } from './types';

export function createFurnitureTool(ctx: ToolCtx): ToolHandler {
  return {
    onMouseDown(e) {
      const { pendingFurnitureTemplateId } = ctx.stateRef.current;
      if (!pendingFurnitureTemplateId) return;
      const template = getTemplate(pendingFurnitureTemplateId);
      if (!template) return;
      ctx.addFurniture({
        templateId: template.id,
        label: template.label,
        position: ctx.rawToWorld(e),
        width: template.defaultWidth,
        depth: template.defaultDepth,
        rotation: 0,
        color: template.defaultColor,
        locked: false,
      });
    },

    onMouseMove(e) {
      ctx.setGhostPoint(ctx.rawToWorld(e));
      ctx.onSnapChange(null);
    },
  };
}
