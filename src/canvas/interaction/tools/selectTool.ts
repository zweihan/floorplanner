import { worldToScreen, PPCM } from '../../../geometry/transforms';
import { hitTestPlan, hitTestWallEndpoint, hitTestPlanInRect, type BBox } from '../../../geometry/hitTest';
import { applySnapping } from '../../../geometry/snapping';
import { distance } from '../../../geometry/point';
import type { Plan, Point } from '../../../types/plan';
import type { ToolCtx, ToolHandler } from './types';

export function createSelectTool(ctx: ToolCtx): ToolHandler {
  let rubberBandStart: Point | null = null;

  let elementDrag: {
    ids: string[];
    basePlan: Plan;
    startWorld: Point;
    lastDelta: Point;
  } | null = null;

  let endpointDrag: {
    wallIds: Array<{ id: string; endpoint: 'start' | 'end' }>;
    basePlan: Plan;
    lastPosition: Point;
  } | null = null;

  let furnitureResize: {
    id: string;
    cos: number;
    sin: number;
    center: Point;
    basePlan: Plan;
    lastWidth: number;
    lastDepth: number;
  } | null = null;

  let furnitureRotate: {
    id: string;
    centerScreen: { x: number; y: number };
    startAngle: number;
    baseRotation: number;
    basePlan: Plan;
    lastRotation: number;
  } | null = null;

  function cancelDrags() {
    if (furnitureRotate) {
      ctx.setActivePlanNoHistory(furnitureRotate.basePlan);
      furnitureRotate = null;
    }
    if (furnitureResize) {
      ctx.setActivePlanNoHistory(furnitureResize.basePlan);
      furnitureResize = null;
    }
    if (endpointDrag) {
      ctx.setActivePlanNoHistory(endpointDrag.basePlan);
      endpointDrag = null;
    }
    if (elementDrag) {
      ctx.setActivePlanNoHistory(elementDrag.basePlan);
      elementDrag = null;
    }
    if (rubberBandStart) {
      rubberBandStart = null;
      ctx.onRubberBandChange(null);
    }
  }

  return {
    onMouseDown(e) {
      const { plans, activePlanId, selectedIds } = ctx.stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return;

      const world = ctx.rawToWorld(e);
      const threshold = ctx.getHitThreshold();
      const vp = ctx.getViewport();
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // 1a. Furniture rotation + resize handles (selected items only)
      for (const item of plan.furniture) {
        if (!selectedIds.includes(item.id)) continue;
        const rotRad = item.rotation * Math.PI / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        const hw = item.width / 2;
        const hd = item.depth / 2;

        // Rotation handle: 24px above top-center
        const topCenterWorld = { x: item.position.x + sin * hd, y: item.position.y - cos * hd };
        const stc = worldToScreen(topCenterWorld.x, topCenterWorld.y, vp, PPCM);
        const rhx = stc.x + sin * 24;
        const rhy = stc.y - cos * 24;
        if (Math.hypot(mx - rhx, my - rhy) <= 8) {
          const itemCenter = worldToScreen(item.position.x, item.position.y, vp, PPCM);
          furnitureRotate = {
            id: item.id,
            centerScreen: itemCenter,
            startAngle: Math.atan2(my - itemCenter.y, mx - itemCenter.x),
            baseRotation: item.rotation,
            basePlan: structuredClone(plan),
            lastRotation: item.rotation,
          };
          return;
        }

        // Corner resize handles
        const corners = [
          { x: item.position.x + cos * (-hw) - sin * (-hd), y: item.position.y + sin * (-hw) + cos * (-hd) },
          { x: item.position.x + cos *   hw  - sin * (-hd), y: item.position.y + sin *   hw  + cos * (-hd) },
          { x: item.position.x + cos *   hw  - sin *   hd,  y: item.position.y + sin *   hw  + cos *   hd  },
          { x: item.position.x + cos * (-hw) - sin *   hd,  y: item.position.y + sin * (-hw) + cos *   hd  },
        ];
        for (const corner of corners) {
          const sc = worldToScreen(corner.x, corner.y, vp, PPCM);
          if (Math.hypot(mx - sc.x, my - sc.y) <= 8) {
            furnitureResize = {
              id: item.id, cos, sin,
              center: item.position,
              basePlan: structuredClone(plan),
              lastWidth: item.width,
              lastDepth: item.depth,
            };
            return;
          }
        }
      }

      // 1b. Endpoint drag handles (selected walls)
      for (const wall of plan.walls) {
        if (!selectedIds.includes(wall.id)) continue;
        const endpt = hitTestWallEndpoint(wall, world, threshold);
        if (endpt !== null) {
          const sharedPt = endpt === 'start' ? wall.start : wall.end;
          const joined: Array<{ id: string; endpoint: 'start' | 'end' }> = [];
          for (const w of plan.walls) {
            if (distance(w.start, sharedPt) < 1.0) joined.push({ id: w.id, endpoint: 'start' });
            else if (distance(w.end, sharedPt) < 1.0) joined.push({ id: w.id, endpoint: 'end' });
          }
          endpointDrag = { wallIds: joined, basePlan: structuredClone(plan), lastPosition: world };
          return;
        }
      }

      // 2. Hit test element
      const hit = hitTestPlan(plan, world, threshold);

      if (hit) {
        const newSelection = e.shiftKey
          ? (selectedIds.includes(hit) ? selectedIds.filter(id => id !== hit) : [...selectedIds, hit])
          : (selectedIds.includes(hit) ? selectedIds : [hit]);
        ctx.setSelectedIds(newSelection);
        elementDrag = {
          ids: newSelection.length > 0 ? newSelection : [hit],
          basePlan: structuredClone(plan),
          startWorld: world,
          lastDelta: { x: 0, y: 0 },
        };
      } else {
        if (!e.shiftKey) ctx.setSelectedIds([]);
        rubberBandStart = world;
        ctx.onRubberBandChange({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
      }
    },

    onMouseMove(e) {
      const raw = ctx.rawToWorld(e);

      if (furnitureRotate) {
        const { id, centerScreen, startAngle, baseRotation, basePlan } = furnitureRotate;
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const currentAngle = Math.atan2(sy - centerScreen.y, sx - centerScreen.x);
        let newRotation = baseRotation + (currentAngle - startAngle) * 180 / Math.PI;
        if (e.shiftKey) newRotation = Math.round(newRotation / 15) * 15;
        furnitureRotate.lastRotation = newRotation;
        const updatedPlan: Plan = {
          ...basePlan,
          furniture: basePlan.furniture.map(f => f.id === id ? { ...f, rotation: newRotation } : f),
        };
        ctx.setActivePlanNoHistory(updatedPlan);
        return;
      }

      if (furnitureResize) {
        const { id, cos, sin, center, basePlan } = furnitureResize;
        const dx = raw.x - center.x;
        const dy = raw.y - center.y;
        const localX = dx * cos + dy * sin;
        const localY = -dx * sin + dy * cos;
        const newWidth = Math.max(1, Math.abs(localX) * 2);
        const newDepth = Math.max(1, Math.abs(localY) * 2);
        furnitureResize.lastWidth = newWidth;
        furnitureResize.lastDepth = newDepth;
        const updatedPlan: Plan = {
          ...basePlan,
          furniture: basePlan.furniture.map(f => f.id === id ? { ...f, width: newWidth, depth: newDepth } : f),
        };
        ctx.setActivePlanNoHistory(updatedPlan);
        return;
      }

      if (endpointDrag) {
        const { wallIds, basePlan } = endpointDrag;
        const { settings } = ctx.stateRef.current;
        const snap = applySnapping(raw, basePlan.walls, settings, basePlan.viewport, PPCM, null, false, basePlan.gridSize);
        const updatedWalls = basePlan.walls.map(w => {
          const match = wallIds.find(j => j.id === w.id);
          if (!match) return w;
          return match.endpoint === 'start' ? { ...w, start: snap.point } : { ...w, end: snap.point };
        });
        ctx.setActivePlanNoHistory({ ...basePlan, walls: updatedWalls });
        endpointDrag.lastPosition = snap.point;
        ctx.setGhostPoint(snap.point);
        ctx.onSnapChange(snap);
        return;
      }

      if (elementDrag) {
        const { basePlan, startWorld, ids } = elementDrag;
        const { settings, plans, activePlanId } = ctx.stateRef.current;
        const plan = activePlanId ? plans[activePlanId] : basePlan;
        const dx = raw.x - startWorld.x;
        const dy = raw.y - startWorld.y;
        let snapDx = dx, snapDy = dy;
        if (settings.snapToGrid && plan.gridSize > 0) {
          const g = plan.gridSize;
          snapDx = Math.round(dx / g) * g;
          snapDy = Math.round(dy / g) * g;
        }
        const idSet = new Set(ids);
        const updatedPlan: Plan = {
          ...basePlan,
          walls: basePlan.walls.map(w => idSet.has(w.id)
            ? { ...w, start: { x: w.start.x + snapDx, y: w.start.y + snapDy }, end: { x: w.end.x + snapDx, y: w.end.y + snapDy } }
            : w),
          openings: basePlan.openings.map(o => {
            if (!idSet.has(o.id)) return o;
            const wall = basePlan.walls.find(w => w.id === o.wallId);
            if (!wall) return o;
            const wdx = wall.end.x - wall.start.x;
            const wdy = wall.end.y - wall.start.y;
            const wallLen2 = wdx * wdx + wdy * wdy;
            if (wallLen2 < 1) return o;
            const nx = wall.start.x + o.position * wdx + snapDx;
            const ny = wall.start.y + o.position * wdy + snapDy;
            const newT = Math.max(0, Math.min(1,
              ((nx - wall.start.x) * wdx + (ny - wall.start.y) * wdy) / wallLen2
            ));
            return { ...o, position: newT };
          }),
          rooms: basePlan.rooms.map(r => idSet.has(r.id)
            ? { ...r, points: r.points.map(p => ({ x: p.x + snapDx, y: p.y + snapDy })), labelPosition: { x: r.labelPosition.x + snapDx, y: r.labelPosition.y + snapDy } }
            : r),
          furniture: basePlan.furniture.map(f => idSet.has(f.id)
            ? { ...f, position: { x: f.position.x + snapDx, y: f.position.y + snapDy } }
            : f),
          textLabels: basePlan.textLabels.map(t => idSet.has(t.id)
            ? { ...t, position: { x: t.position.x + snapDx, y: t.position.y + snapDy } }
            : t),
        };
        ctx.setActivePlanNoHistory(updatedPlan);
        elementDrag.lastDelta = { x: snapDx, y: snapDy };
        return;
      }

      if (rubberBandStart) {
        ctx.onRubberBandChange({ x1: rubberBandStart.x, y1: rubberBandStart.y, x2: raw.x, y2: raw.y });
        return;
      }

      // Default: update coordinate display
      ctx.setGhostPoint(raw);
      ctx.onSnapChange(null);
    },

    onMouseUp(e) {
      if (e.button !== 0) return;

      if (furnitureRotate) {
        const { id, baseRotation, basePlan, lastRotation } = furnitureRotate;
        ctx.setActivePlanNoHistory(basePlan);
        if (Math.abs(lastRotation - baseRotation) > 0.1) {
          ctx.updateFurniture(id, { rotation: lastRotation });
        }
        furnitureRotate = null;
        return;
      }

      if (furnitureResize) {
        const { id, basePlan, lastWidth, lastDepth } = furnitureResize;
        const baseItem = basePlan.furniture.find(f => f.id === id)!;
        ctx.setActivePlanNoHistory(basePlan);
        if (Math.abs(lastWidth - baseItem.width) > 0.1 || Math.abs(lastDepth - baseItem.depth) > 0.1) {
          ctx.updateFurniture(id, { width: lastWidth, depth: lastDepth });
        }
        furnitureResize = null;
        return;
      }

      if (endpointDrag) {
        const { wallIds, basePlan, lastPosition } = endpointDrag;
        ctx.setActivePlanNoHistory(basePlan);
        ctx.updateWallEndpoints(wallIds.map(j => ({ ...j, position: lastPosition })));
        endpointDrag = null;
        ctx.setGhostPoint(null);
        ctx.onSnapChange(null);
        return;
      }

      if (elementDrag) {
        const { basePlan, ids, lastDelta } = elementDrag;
        if (Math.abs(lastDelta.x) > 0.01 || Math.abs(lastDelta.y) > 0.01) {
          ctx.setActivePlanNoHistory(basePlan);
          ctx.moveElements(ids, lastDelta.x, lastDelta.y);
        } else {
          ctx.setActivePlanNoHistory(basePlan);
        }
        elementDrag = null;
        return;
      }

      if (rubberBandStart) {
        const { plans, activePlanId } = ctx.stateRef.current;
        const plan = activePlanId ? plans[activePlanId] : null;
        const raw = ctx.rawToWorld(e);
        if (plan && (Math.abs(raw.x - rubberBandStart.x) > 1 || Math.abs(raw.y - rubberBandStart.y) > 1)) {
          const bbox: BBox = {
            minX: Math.min(rubberBandStart.x, raw.x),
            minY: Math.min(rubberBandStart.y, raw.y),
            maxX: Math.max(rubberBandStart.x, raw.x),
            maxY: Math.max(rubberBandStart.y, raw.y),
          };
          ctx.setSelectedIds(hitTestPlanInRect(plan, bbox));
        }
        rubberBandStart = null;
        ctx.onRubberBandChange(null);
        return;
      }
    },

    onDblClick(e) {
      const { plans, activePlanId } = ctx.stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return;
      const world = ctx.rawToWorld(e);
      const threshold = ctx.getHitThreshold();
      const hit = hitTestPlan(plan, world, threshold);
      if (hit && plan.textLabels.find(t => t.id === hit)) {
        ctx.setSelectedIds([hit]);
        ctx.setEditingTextLabelId(hit);
      }
    },

    onMouseLeave() {
      cancelDrags();
      ctx.setGhostPoint(null);
      ctx.onSnapChange(null);
    },
  };
}
