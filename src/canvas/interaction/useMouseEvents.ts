import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { screenToWorld, worldToScreen, PPCM } from '../../geometry/transforms';
import { applySnapping } from '../../geometry/snapping';
import { distance } from '../../geometry/point';
import { polygonCentroid } from '../../geometry/polygon';
import {
  hitTestPlan,
  hitTestWall,
  hitTestWallEndpoint,
  hitTestPlanInRect,
  type BBox,
} from '../../geometry/hitTest';
import type { OpeningGhost } from '../layers/openings';
import { getTemplate } from '../../data/furnitureTemplates';
import { ROOM_COLORS } from '../../data/roomColors';
import type { Plan, Point } from '../../types/plan';
import type { SnapResult } from '../../types/tools';

type RubberBandRect = { x1: number; y1: number; x2: number; y2: number };

/**
 * Attaches all mouse interaction handlers to the canvas.
 * Handles: select tool (click, shift-click, rubber-band, drag-move, endpoint-drag),
 * wall tool drawing, and pan (Space+drag / middle-mouse).
 */
export function useMouseEvents(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onSnapChange: (snap: SnapResult | null) => void,
  onRubberBandChange: (rect: RubberBandRect | null) => void,
  onOpeningGhostChange: (ghost: OpeningGhost | null) => void
): void {
  // ─── Reactive store state (read via stateRef to avoid re-attaching listeners)
  const activeTool = useStore(s => s.activeTool);
  const wallChain = useStore(s => s.wallChain);
  const settings = useStore(s => s.settings);
  const plans = useStore(s => s.plans);
  const activePlanId = useStore(s => s.activePlanId);
  const selectedIds = useStore(s => s.selectedIds);
  const pendingFurnitureTemplateId = useStore(s => s.pendingFurnitureTemplateId);

  const stateRef = useRef({ activeTool, wallChain, settings, plans, activePlanId, selectedIds, pendingFurnitureTemplateId });
  stateRef.current = { activeTool, wallChain, settings, plans, activePlanId, selectedIds, pendingFurnitureTemplateId };

  // ─── Stable store actions
  const addWall = useStore(s => s.addWall);
  const addRoom = useStore(s => s.addRoom);
  const addOpening = useStore(s => s.addOpening);
  const addFurniture = useStore(s => s.addFurniture);
  const updateFurniture = useStore(s => s.updateFurniture);
  const pushToChain = useStore(s => s.pushToChain);
  const clearChain = useStore(s => s.clearChain);
  const setGhostPoint = useStore(s => s.setGhostPoint);
  const setCamera = useStore(s => s.setCamera);
  const undo = useStore(s => s.undo);
  const setSelectedIds = useStore(s => s.setSelectedIds);
  const moveElements = useStore(s => s.moveElements);
  const setActivePlanNoHistory = useStore(s => s.setActivePlanNoHistory);
  const updateWallEndpoints = useStore(s => s.updateWallEndpoints);

  // ─── Pan state
  const isPanning = useRef(false);
  const panStart = useRef<{ mx: number; my: number; panX: number; panY: number } | null>(null);
  const isSpaceDown = useRef(false);
  // Track walls committed in current chain for double-click undo
  const wallsInChain = useRef(0);

  // ─── Select drag state
  const rubberBandRef = useRef<{ start: Point; current: Point } | null>(null);

  const elementDragRef = useRef<{
    ids: string[];
    basePlan: Plan;
    startWorld: Point;
    lastDelta: Point;
  } | null>(null);

  const endpointDragRef = useRef<{
    wallIds: Array<{ id: string; endpoint: 'start' | 'end' }>;
    basePlan: Plan;
    lastPosition: Point;
  } | null>(null);

  const furnitureResizeRef = useRef<{
    id: string;
    cos: number;
    sin: number;
    center: Point;
    basePlan: Plan;
    lastWidth: number;
    lastDepth: number;
  } | null>(null);

  const furnitureRotateRef = useRef<{
    id: string;
    centerScreen: { x: number; y: number };
    startAngle: number;
    baseRotation: number;
    basePlan: Plan;
    lastRotation: number;
  } | null>(null);

  // Set grab cursor when pan tool is active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor = activeTool === 'pan' ? 'grab' : '';
  }, [activeTool, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    const commitRoom = (chain: Point[]) => {
      if (chain.length < 3) { clearChain(); return; }
      const { plans, activePlanId } = stateRef.current;
      const roomCount = activePlanId ? (plans[activePlanId]?.rooms.length ?? 0) : 0;
      const color = ROOM_COLORS[roomCount % ROOM_COLORS.length];
      addRoom({
        name: `Room ${roomCount + 1}`,
        wallIds: [],
        points: chain,
        color,
        area: 0,
        labelPosition: polygonCentroid(chain),
        showArea: true,
        showLabel: true,
      });
      clearChain();
      setGhostPoint(null);
      onSnapChange(null);
    };

    const getViewport = () => {
      const { plans, activePlanId } = stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      return plan?.viewport ?? { panX: 0, panY: 0, zoom: 1 };
    };

    const rawToWorld = (e: MouseEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, getViewport(), PPCM);
    };

    const getSnapped = (e: MouseEvent, chainStart: Point | null): SnapResult => {
      const raw = rawToWorld(e);
      const { settings, plans, activePlanId } = stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return { point: raw, type: 'none' };
      return applySnapping(raw, plan.walls, settings, plan.viewport, PPCM, chainStart, e.shiftKey);
    };

    // Hit test threshold: 8 screen px → world cm
    const getHitThreshold = () => 8 / (PPCM * getViewport().zoom);

    // Find the nearest wall under cursor for opening placement.
    // Accepts clicks anywhere on the wall body; clamps t away from endpoints.
    const findOpeningTarget = (e: MouseEvent): OpeningGhost | null => {
      const raw = rawToWorld(e);
      const { plans, activePlanId } = stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return null;
      const threshold = getHitThreshold();
      let best: { wallId: string; t: number; dist: number } | null = null;
      for (const wall of plan.walls) {
        if (!hitTestWall(wall, raw, threshold)) continue;
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const wallLen = Math.hypot(dx, dy);
        if (wallLen < 1) continue;
        const tRaw = ((raw.x - wall.start.x) * dx + (raw.y - wall.start.y) * dy) / (wallLen * wallLen);
        const t = Math.max(0.05, Math.min(0.95, tRaw));
        const projX = wall.start.x + t * dx;
        const projY = wall.start.y + t * dy;
        const dist = Math.hypot(raw.x - projX, raw.y - projY);
        if (!best || dist < best.dist) best = { wallId: wall.id, t, dist };
      }
      return best ? { wallId: best.wallId, t: best.t } : null;
    };

    // ─── Mouse down ──────────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const vp = getViewport();

      // Middle-mouse, Space+left, or pan tool → start pan
      if (e.button === 1 || (isSpaceDown.current && e.button === 0) || (stateRef.current.activeTool === 'pan' && e.button === 0)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { mx: e.clientX, my: e.clientY, panX: vp.panX, panY: vp.panY };
        canvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;

      const { activeTool, wallChain, plans, activePlanId, selectedIds } = stateRef.current;

      // ── Wall tool ───────────────────────────────────────────────────────────
      if (activeTool === 'wall') {
        const lastPt = wallChain.length > 0 ? wallChain[wallChain.length - 1] : null;
        const snap = getSnapped(e, lastPt);
        onSnapChange(snap);

        if (wallChain.length === 0) {
          pushToChain(snap.point);
          wallsInChain.current = 0;
        } else {
          const from = wallChain[wallChain.length - 1];
          if (distance(from, snap.point) < 0.5) return;

          // Chain closure
          if (wallChain.length >= 2 && distance(snap.point, wallChain[0]) < 1.0) {
            addWall(from, wallChain[0]);
            clearChain();
            onSnapChange(null);
            wallsInChain.current = 0;
          } else {
            addWall(from, snap.point);
            pushToChain(snap.point);
            wallsInChain.current++;
          }
        }
        return;
      }

      // ── Room tool ───────────────────────────────────────────────────────────
      if (activeTool === 'room') {
        const snap = getSnapped(e, wallChain.length > 0 ? wallChain[wallChain.length - 1] : null);
        onSnapChange(snap);

        if (wallChain.length === 0) {
          pushToChain(snap.point);
        } else {
          const threshold = getHitThreshold() * 2;
          // Close the polygon if clicking near the first vertex (≥3 vertices)
          if (wallChain.length >= 3 && distance(snap.point, wallChain[0]) < threshold) {
            commitRoom(wallChain);
          } else if (distance(snap.point, wallChain[wallChain.length - 1]) > 0.5) {
            pushToChain(snap.point);
          }
        }
        return;
      }

      // ── Door / Window / Opening tool ────────────────────────────────────────
      if (activeTool === 'door' || activeTool === 'window' || activeTool === 'opening') {
        const target = findOpeningTarget(e);
        if (!target) return;
        const isDoor = activeTool === 'door';
        const isOpening = activeTool === 'opening';
        addOpening({
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
        onOpeningGhostChange(null);
        return;
      }

      // ── Furniture tool ───────────────────────────────────────────────────────
      if (activeTool === 'furniture') {
        const { pendingFurnitureTemplateId } = stateRef.current;
        if (!pendingFurnitureTemplateId) return;
        const template = getTemplate(pendingFurnitureTemplateId);
        if (!template) return;
        const world = rawToWorld(e);
        addFurniture({
          templateId: template.id,
          label: template.label,
          position: world,
          width: template.defaultWidth,
          depth: template.defaultDepth,
          rotation: 0,
          color: template.defaultColor,
          locked: false,
        });
        return;
      }

      // ── Select tool ─────────────────────────────────────────────────────────
      if (activeTool === 'select') {
        const plan = activePlanId ? plans[activePlanId] : null;
        if (!plan) return;

        const world = rawToWorld(e);
        const threshold = getHitThreshold();

        // 1a. Check furniture handles (rotation + resize corners) of selected items
        {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const vp = getViewport();

          for (const item of plan.furniture) {
            if (!selectedIds.includes(item.id)) continue;
            const rotRad = item.rotation * Math.PI / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            const hw = item.width / 2;
            const hd = item.depth / 2;

            // Rotation handle
            const topCenterWorld = { x: item.position.x + sin * hd, y: item.position.y - cos * hd };
            const stc = worldToScreen(topCenterWorld.x, topCenterWorld.y, vp, PPCM);
            const rhx = stc.x + sin * 24;
            const rhy = stc.y - cos * 24;
            if (Math.hypot(mx - rhx, my - rhy) <= 8) {
              const itemCenter = worldToScreen(item.position.x, item.position.y, vp, PPCM);
              furnitureRotateRef.current = {
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
                furnitureResizeRef.current = {
                  id: item.id,
                  cos, sin,
                  center: item.position,
                  basePlan: structuredClone(plan),
                  lastWidth: item.width,
                  lastDepth: item.depth,
                };
                return;
              }
            }
          }
        }

        // 1. Check endpoint handles of selected walls first (higher priority)
        for (const wall of plan.walls) {
          if (!selectedIds.includes(wall.id)) continue;
          const endpt = hitTestWallEndpoint(wall, world, threshold);
          if (endpt !== null) {
            // Gather all walls sharing this endpoint (auto-join)
            const sharedPt = endpt === 'start' ? wall.start : wall.end;
            const joined: Array<{ id: string; endpoint: 'start' | 'end' }> = [];
            for (const w of plan.walls) {
              if (distance(w.start, sharedPt) < 1.0) joined.push({ id: w.id, endpoint: 'start' });
              else if (distance(w.end, sharedPt) < 1.0) joined.push({ id: w.id, endpoint: 'end' });
            }
            endpointDragRef.current = {
              wallIds: joined,
              basePlan: structuredClone(plan),
              lastPosition: world,
            };
            return;
          }
        }

        // 2. Hit test for element
        const hit = hitTestPlan(plan, world, threshold);

        if (hit) {
          const newSelection = e.shiftKey
            ? (selectedIds.includes(hit) ? selectedIds.filter(id => id !== hit) : [...selectedIds, hit])
            : (selectedIds.includes(hit) ? selectedIds : [hit]);

          setSelectedIds(newSelection);

          // Start element drag
          elementDragRef.current = {
            ids: newSelection.length > 0 ? newSelection : [hit],
            basePlan: structuredClone(plan),
            startWorld: world,
            lastDelta: { x: 0, y: 0 },
          };
        } else {
          // Click on empty space
          if (!e.shiftKey) setSelectedIds([]);
          rubberBandRef.current = { start: world, current: world };
          onRubberBandChange({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
        }
        return;
      }
    };

    // ─── Mouse move ──────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      // Pan
      if (isPanning.current && panStart.current) {
        setCamera({
          panX: panStart.current.panX + (e.clientX - panStart.current.mx),
          panY: panStart.current.panY + (e.clientY - panStart.current.my),
        });
        return;
      }

      const { activeTool, wallChain, settings, plans, activePlanId } = stateRef.current;
      const plan = activePlanId ? plans[activePlanId] : null;
      if (!plan) return;

      const raw = rawToWorld(e);

      // ── Wall tool ghost ─────────────────────────────────────────────────────
      if (activeTool === 'wall' && wallChain.length > 0) {
        const lastPt = wallChain[wallChain.length - 1];
        const snap = applySnapping(raw, plan.walls, settings, plan.viewport, PPCM, lastPt, e.shiftKey);
        setGhostPoint(snap.point);
        onSnapChange(snap);
        return;
      }

      // ── Room tool ghost ─────────────────────────────────────────────────────
      if (activeTool === 'room' && wallChain.length > 0) {
        const lastPt = wallChain[wallChain.length - 1];
        const snap = applySnapping(raw, plan.walls, settings, plan.viewport, PPCM, lastPt, e.shiftKey);
        setGhostPoint(snap.point);
        onSnapChange(snap);
        return;
      }

      // ── Door / Window / Opening tool ghost ─────────────────────────────────
      if (activeTool === 'door' || activeTool === 'window' || activeTool === 'opening') {
        const target = findOpeningTarget(e);
        onOpeningGhostChange(target);
        setGhostPoint(rawToWorld(e));
        return;
      }

      // ── Select tool drags ───────────────────────────────────────────────────
      if (activeTool === 'select') {
        // Furniture rotate drag
        if (furnitureRotateRef.current) {
          const { id, centerScreen, startAngle, baseRotation, basePlan } = furnitureRotateRef.current;
          const rect = canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const currentAngle = Math.atan2(sy - centerScreen.y, sx - centerScreen.x);
          let newRotation = baseRotation + (currentAngle - startAngle) * 180 / Math.PI;
          if (e.shiftKey) newRotation = Math.round(newRotation / 15) * 15;
          furnitureRotateRef.current.lastRotation = newRotation;
          const updatedPlan: Plan = {
            ...basePlan,
            furniture: basePlan.furniture.map(f => f.id === id ? { ...f, rotation: newRotation } : f),
          };
          setActivePlanNoHistory(updatedPlan);
          return;
        }

        // Furniture resize drag
        if (furnitureResizeRef.current) {
          const { id, cos, sin, center, basePlan } = furnitureResizeRef.current;
          const dx = raw.x - center.x;
          const dy = raw.y - center.y;
          const localX = dx * cos + dy * sin;
          const localY = -dx * sin + dy * cos;
          const newWidth = Math.max(10, Math.abs(localX) * 2);
          const newDepth = Math.max(10, Math.abs(localY) * 2);
          furnitureResizeRef.current.lastWidth = newWidth;
          furnitureResizeRef.current.lastDepth = newDepth;
          const updatedPlan: Plan = {
            ...basePlan,
            furniture: basePlan.furniture.map(f => f.id === id ? { ...f, width: newWidth, depth: newDepth } : f),
          };
          setActivePlanNoHistory(updatedPlan);
          return;
        }

        // Endpoint drag
        if (endpointDragRef.current) {
          const { wallIds, basePlan } = endpointDragRef.current;
          const snap = applySnapping(raw, basePlan.walls, settings, basePlan.viewport, PPCM);
          // Update all joined endpoints in a preview (no history)
          const updatedWalls = basePlan.walls.map(w => {
            const match = wallIds.find(j => j.id === w.id);
            if (!match) return w;
            return match.endpoint === 'start'
              ? { ...w, start: snap.point }
              : { ...w, end: snap.point };
          });
          setActivePlanNoHistory({ ...basePlan, walls: updatedWalls });
          endpointDragRef.current.lastPosition = snap.point;
          setGhostPoint(snap.point);
          onSnapChange(snap);
          return;
        }

        // Element drag
        if (elementDragRef.current) {
          const { basePlan, startWorld, ids } = elementDragRef.current;
          const dx = raw.x - startWorld.x;
          const dy = raw.y - startWorld.y;

          // Snap delta to grid
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
          setActivePlanNoHistory(updatedPlan);
          elementDragRef.current.lastDelta = { x: snapDx, y: snapDy };
          return;
        }

        // Rubber-band update
        if (rubberBandRef.current) {
          rubberBandRef.current.current = raw;
          const s = rubberBandRef.current.start;
          onRubberBandChange({ x1: s.x, y1: s.y, x2: raw.x, y2: raw.y });
          return;
        }
      }

      // Default: update ghost point for coordinate display
      setGhostPoint(raw);
      onSnapChange(null);
    };

    // ─── Mouse up ────────────────────────────────────────────────────────────
    const onMouseUp = (e: MouseEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current = null;
        const { activeTool } = stateRef.current;
        canvas.style.cursor = isSpaceDown.current || activeTool === 'pan' ? 'grab' : '';
        return;
      }

      if (e.button !== 0) return;

      // Furniture rotate commit
      if (furnitureRotateRef.current) {
        const { id, baseRotation, basePlan, lastRotation } = furnitureRotateRef.current;
        setActivePlanNoHistory(basePlan);
        if (Math.abs(lastRotation - baseRotation) > 0.1) {
          updateFurniture(id, { rotation: lastRotation });
        }
        furnitureRotateRef.current = null;
        return;
      }

      // Furniture resize commit
      if (furnitureResizeRef.current) {
        const { id, basePlan, lastWidth, lastDepth } = furnitureResizeRef.current;
        const baseItem = basePlan.furniture.find(f => f.id === id)!;
        setActivePlanNoHistory(basePlan);
        if (Math.abs(lastWidth - baseItem.width) > 0.1 || Math.abs(lastDepth - baseItem.depth) > 0.1) {
          updateFurniture(id, { width: lastWidth, depth: lastDepth });
        }
        furnitureResizeRef.current = null;
        return;
      }

      // Endpoint drag commit
      if (endpointDragRef.current) {
        const { wallIds, basePlan, lastPosition } = endpointDragRef.current;
        // Restore base, then commit as single history entry
        setActivePlanNoHistory(basePlan);
        updateWallEndpoints(wallIds.map(j => ({ ...j, position: lastPosition })));
        endpointDragRef.current = null;
        setGhostPoint(null);
        onSnapChange(null);
        return;
      }

      // Element drag commit
      if (elementDragRef.current) {
        const { basePlan, ids, lastDelta } = elementDragRef.current;
        if (Math.abs(lastDelta.x) > 0.01 || Math.abs(lastDelta.y) > 0.01) {
          setActivePlanNoHistory(basePlan);
          moveElements(ids, lastDelta.x, lastDelta.y);
        } else {
          // No movement — restore cleanly (in case plan was dirtied)
          setActivePlanNoHistory(basePlan);
        }
        elementDragRef.current = null;
        return;
      }

      // Rubber-band commit
      if (rubberBandRef.current) {
        const s = rubberBandRef.current.start;
        const c = rubberBandRef.current.current;
        const { plans, activePlanId } = stateRef.current;
        const plan = activePlanId ? plans[activePlanId] : null;
        if (plan && (Math.abs(c.x - s.x) > 1 || Math.abs(c.y - s.y) > 1)) {
          const rect: BBox = {
            minX: Math.min(s.x, c.x),
            minY: Math.min(s.y, c.y),
            maxX: Math.max(s.x, c.x),
            maxY: Math.max(s.y, c.y),
          };
          setSelectedIds(hitTestPlanInRect(plan, rect));
        }
        rubberBandRef.current = null;
        onRubberBandChange(null);
        return;
      }
    };

    // ─── Mouse leave ─────────────────────────────────────────────────────────
    const onMouseLeave = () => {
      isPanning.current = false;
      panStart.current = null;
      // Cancel any in-flight drag and restore base plan
      if (furnitureRotateRef.current) {
        setActivePlanNoHistory(furnitureRotateRef.current.basePlan);
        furnitureRotateRef.current = null;
      }
      if (furnitureResizeRef.current) {
        setActivePlanNoHistory(furnitureResizeRef.current.basePlan);
        furnitureResizeRef.current = null;
      }
      if (endpointDragRef.current) {
        setActivePlanNoHistory(endpointDragRef.current.basePlan);
        endpointDragRef.current = null;
      }
      if (elementDragRef.current) {
        setActivePlanNoHistory(elementDragRef.current.basePlan);
        elementDragRef.current = null;
      }
      if (rubberBandRef.current) {
        rubberBandRef.current = null;
        onRubberBandChange(null);
      }
      setGhostPoint(null);
      onSnapChange(null);
      onOpeningGhostChange(null);
    };

    // ─── Double click: end wall chain / commit room ───────────────────────────
    const onDblClick = () => {
      const { activeTool } = stateRef.current;
      if (activeTool === 'wall') {
        if (wallsInChain.current > 0) {
          undo();
          wallsInChain.current--;
        }
        clearChain();
        onSnapChange(null);
      } else if (activeTool === 'room') {
        // Read chain directly from store — stateRef may lag behind the mousedown push
        const chain = useStore.getState().wallChain;
        // Remove the last vertex added by this dblclick's mousedown (duplicate)
        const pts = chain.length >= 2 ? chain.slice(0, -1) : chain;
        commitRoom(pts);
      }
    };

    // ─── Context menu: cancel drawing ────────────────────────────────────────
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const { activeTool } = stateRef.current;
      if (activeTool === 'wall' || activeTool === 'room') {
        clearChain();
        onSnapChange(null);
      }
    };

    // ─── Space key: temporary pan mode ───────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        isSpaceDown.current = true;
        canvas.style.cursor = 'grab';
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDown.current = false;
        if (!isPanning.current) canvas.style.cursor = '';
        isPanning.current = false;
        panStart.current = null;
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // Stable actions only — state read via stateRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasRef,
    addWall, addRoom, addOpening, addFurniture, updateFurniture,
    pushToChain, clearChain, setGhostPoint, setCamera, undo,
    setSelectedIds, moveElements, setActivePlanNoHistory, updateWallEndpoints,
    onSnapChange, onRubberBandChange, onOpeningGhostChange,
  ]);
}
