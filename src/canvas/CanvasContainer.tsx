import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useCanvas } from './useCanvas';
import { render } from './renderer';
import { applyZoom, PPCM } from '../geometry/transforms';
import { useMouseEvents } from './interaction/useMouseEvents';
import { ScaleBar } from '../components/HUD/ScaleBar';
import { CoordinateDisplay } from '../components/HUD/CoordinateDisplay';
import { ZoomControls } from '../components/HUD/ZoomControls';
import type { SnapResult } from '../types/tools';

export function CanvasContainer() {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const selectedIds = useStore(s => s.selectedIds);
  const hoveredId = useStore(s => s.hoveredId);
  const ghostPoint = useStore(s => s.ghostPoint);
  const wallChain = useStore(s => s.wallChain);
  const drawingState = useStore(s => s.drawingState);
  const showGrid = useStore(s => s.showGrid);
  const layers = useStore(s => s.layers);
  const settings = useStore(s => s.settings);
  const pendingFurnitureTemplateId = useStore(s => s.pendingFurnitureTemplateId);
  const activeTool = useStore(s => s.activeTool);
  const setCamera = useStore(s => s.setCamera);

  const plan = activePlanId ? plans[activePlanId] : null;

  // ─── Snap + rubber-band state from mouse handler ─────────────────────────
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const onSnapChange = useCallback((snap: SnapResult | null) => setSnapResult(snap), []);

  type RubberBandRect = { x1: number; y1: number; x2: number; y2: number };
  const [rubberBandRect, setRubberBandRect] = useState<RubberBandRect | null>(null);
  const onRubberBandChange = useCallback((rect: RubberBandRect | null) => setRubberBandRect(rect), []);

  // ─── Render function ──────────────────────────────────────────────────────
  const renderFn = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (!plan) return;
      render(ctx, w, h, {
        plan,
        viewport: plan.viewport,
        settings,
        selectedIds,
        hoveredId,
        ghostPoint,
        wallChain,
        drawingState,
        showGrid,
        layers,
        pendingFurnitureTemplateId,
        snapResult,
        rubberBandRect,
        ppcm: PPCM,
      });
    },
    [plan, settings, selectedIds, hoveredId, ghostPoint, wallChain, drawingState, showGrid, layers, pendingFurnitureTemplateId, snapResult, rubberBandRect]
  );

  const canvasRef = useCanvas(renderFn);

  // ─── Wire all mouse interaction ───────────────────────────────────────────
  useMouseEvents(canvasRef, onSnapChange, onRubberBandChange);

  // ─── Scroll wheel: zoom centred on cursor ─────────────────────────────────
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!planRef.current) return;
      const rect = canvas.getBoundingClientRect();
      setCamera(applyZoom(planRef.current.viewport, e.deltaY, e.clientX - rect.left, e.clientY - rect.top));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef, setCamera]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <canvas ref={canvasRef} data-tool={activeTool} />
      <div className="absolute inset-0 pointer-events-none">
        <ScaleBar />
        <CoordinateDisplay />
        <ZoomControls />
      </div>
    </div>
  );
}
