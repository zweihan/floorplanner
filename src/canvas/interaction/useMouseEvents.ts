import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { screenToWorld, PPCM } from '../../geometry/transforms';
import { applySnapping } from '../../geometry/snapping';
import { distance } from '../../geometry/point';
import {
  hitTestPlan,
  hitTestWallEndpoint,
  hitTestPlanInRect,
  type BBox,
} from '../../geometry/hitTest';
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
  onRubberBandChange: (rect: RubberBandRect | null) => void
): void {
  // ─── Reactive store state (read via stateRef to avoid re-attaching listeners)
  const activeTool = useStore(s => s.activeTool);
  const wallChain = useStore(s => s.wallChain);
  const settings = useStore(s => s.settings);
  const plans = useStore(s => s.plans);
  const activePlanId = useStore(s => s.activePlanId);
  const selectedIds = useStore(s => s.selectedIds);

  const stateRef = useRef({ activeTool, wallChain, settings, plans, activePlanId, selectedIds });
  stateRef.current = { activeTool, wallChain, settings, plans, activePlanId, selectedIds };

  // ─── Stable store actions
  const addWall = useStore(s => s.addWall);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Helpers ─────────────────────────────────────────────────────────────
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

    // ─── Mouse down ──────────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const vp = getViewport();

      // Middle-mouse or Space+left → start pan
      if (e.button === 1 || (isSpaceDown.current && e.button === 0)) {
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

      // ── Select tool ─────────────────────────────────────────────────────────
      if (activeTool === 'select') {
        const plan = activePlanId ? plans[activePlanId] : null;
        if (!plan) return;

        const world = rawToWorld(e);
        const threshold = getHitThreshold();

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

      // ── Select tool drags ───────────────────────────────────────────────────
      if (activeTool === 'select') {
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
        canvas.style.cursor = isSpaceDown.current ? 'grab' : '';
        return;
      }

      if (e.button !== 0) return;

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
    };

    // ─── Double click: end wall chain ────────────────────────────────────────
    const onDblClick = () => {
      const { activeTool } = stateRef.current;
      if (activeTool === 'wall') {
        if (wallsInChain.current > 0) {
          undo();
          wallsInChain.current--;
        }
        clearChain();
        onSnapChange(null);
      }
    };

    // ─── Context menu: cancel drawing ────────────────────────────────────────
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const { activeTool } = stateRef.current;
      if (activeTool === 'wall') {
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
    addWall, pushToChain, clearChain, setGhostPoint, setCamera, undo,
    setSelectedIds, moveElements, setActivePlanNoHistory, updateWallEndpoints,
    onSnapChange, onRubberBandChange,
  ]);
}
