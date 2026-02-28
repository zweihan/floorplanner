import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { screenToWorld, PPCM } from '../../geometry/transforms';
import { applySnapping } from '../../geometry/snapping';
import { hitTestWall } from '../../geometry/hitTest';
import type { OpeningGhost } from '../layers/openings';
import type { Point, Viewport } from '../../types/plan';
import type { SnapResult, ToolType } from '../../types/tools';
import type { StateSnapshot, ToolCtx, ToolHandler } from './tools/types';
import { createWallTool } from './tools/wallTool';
import { createRoomTool } from './tools/roomTool';
import { createOpeningTool } from './tools/openingTool';
import { createFurnitureTool } from './tools/furnitureTool';
import { createSelectTool } from './tools/selectTool';
import { createEraserTool } from './tools/eraserTool';
import { createDimensionTool } from './tools/dimensionTool';
import { createTextTool } from './tools/textTool';
import { createCalibrateTool } from './tools/calibrateTool';

type RubberBandRect = { x1: number; y1: number; x2: number; y2: number };

/**
 * Attaches all mouse interaction handlers to the canvas.
 * Delegates to per-tool modules; owns only pan-override logic.
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

  const stateRef = useRef<StateSnapshot>({ activeTool, wallChain, settings, plans, activePlanId, selectedIds, pendingFurnitureTemplateId });
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
  const setCalibrationLine = useStore(s => s.setCalibrationLine);
  const addDimension = useStore(s => s.addDimension);
  const addTextLabel = useStore(s => s.addTextLabel);
  const deleteElements = useStore(s => s.deleteElements);
  const setEditingTextLabelId = useStore(s => s.setEditingTextLabelId);

  // ─── Pan state
  const isPanning = useRef(false);
  const panStart = useRef<{ mx: number; my: number; panX: number; panY: number } | null>(null);
  const isSpaceDown = useRef(false);

  // Set grab cursor when pan tool is active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor = activeTool === 'pan' ? 'grab' : '';
  }, [activeTool, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ─── Shared helpers ────────────────────────────────────────────────────────

    const getViewport = (): Viewport => {
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
      return applySnapping(raw, plan.walls, settings, plan.viewport, PPCM, chainStart, e.shiftKey, plan.gridSize);
    };

    const getHitThreshold = () => 8 / (PPCM * getViewport().zoom);

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

    // ─── Build tool context ────────────────────────────────────────────────────

    const toolCtx: ToolCtx = {
      stateRef,
      getViewport,
      rawToWorld,
      getSnapped,
      getHitThreshold,
      findOpeningTarget,
      addWall, addRoom, addOpening, addFurniture, updateFurniture,
      pushToChain, clearChain, setGhostPoint, undo,
      setSelectedIds, moveElements, setActivePlanNoHistory, updateWallEndpoints,
      setCalibrationLine, addDimension, addTextLabel, deleteElements, setEditingTextLabelId,
      onSnapChange, onRubberBandChange, onOpeningGhostChange,
    };

    // ─── Tool dispatch table ───────────────────────────────────────────────────

    const openingTool = createOpeningTool(toolCtx);
    const handlers: Partial<Record<ToolType, ToolHandler>> = {
      wall:     createWallTool(toolCtx),
      room:     createRoomTool(toolCtx),
      door:     openingTool,
      window:   openingTool,
      opening:  openingTool,
      furniture: createFurnitureTool(toolCtx),
      select:   createSelectTool(toolCtx),
      eraser:   createEraserTool(toolCtx),
      dimension: createDimensionTool(toolCtx),
      text:     createTextTool(toolCtx),
      calibrate: createCalibrateTool(toolCtx),
    };

    // ─── Mouse down ───────────────────────────────────────────────────────────

    const onMouseDown = (e: MouseEvent) => {
      const vp = getViewport();

      // Pan override: middle-mouse, Space+left, or pan tool
      if (e.button === 1 || (isSpaceDown.current && e.button === 0) || (stateRef.current.activeTool === 'pan' && e.button === 0)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { mx: e.clientX, my: e.clientY, panX: vp.panX, panY: vp.panY };
        canvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;
      handlers[stateRef.current.activeTool as ToolType]?.onMouseDown?.(e);
    };

    // ─── Mouse move ───────────────────────────────────────────────────────────

    const onMouseMove = (e: MouseEvent) => {
      if (isPanning.current && panStart.current) {
        setCamera({
          panX: panStart.current.panX + (e.clientX - panStart.current.mx),
          panY: panStart.current.panY + (e.clientY - panStart.current.my),
        });
        return;
      }

      const tool = handlers[stateRef.current.activeTool as ToolType];
      if (tool?.onMouseMove) {
        tool.onMouseMove(e);
      } else {
        // Default: update coordinate display
        setGhostPoint(rawToWorld(e));
        onSnapChange(null);
      }
    };

    // ─── Mouse up ─────────────────────────────────────────────────────────────

    const onMouseUp = (e: MouseEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current = null;
        canvas.style.cursor = isSpaceDown.current || stateRef.current.activeTool === 'pan' ? 'grab' : '';
        return;
      }

      if (e.button !== 0) return;
      handlers[stateRef.current.activeTool as ToolType]?.onMouseUp?.(e);
    };

    // ─── Mouse leave ──────────────────────────────────────────────────────────

    const onMouseLeave = () => {
      isPanning.current = false;
      panStart.current = null;

      const tool = handlers[stateRef.current.activeTool as ToolType];
      if (tool?.onMouseLeave) {
        tool.onMouseLeave();
      } else {
        setGhostPoint(null);
        onSnapChange(null);
        onOpeningGhostChange(null);
      }
    };

    // ─── Double click ─────────────────────────────────────────────────────────

    const onDblClick = (e: MouseEvent) => {
      handlers[stateRef.current.activeTool as ToolType]?.onDblClick?.(e);
    };

    // ─── Context menu: cancel drawing ─────────────────────────────────────────

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handlers[stateRef.current.activeTool as ToolType]?.onContextMenu?.(e);
    };

    // ─── Space key: temporary pan mode ────────────────────────────────────────

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
    setCalibrationLine, addDimension, addTextLabel, deleteElements, setEditingTextLabelId,
    onSnapChange, onRubberBandChange, onOpeningGhostChange,
  ]);
}
