import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useCanvas } from './useCanvas';
import { render } from './renderer';
import { applyZoom, PPCM, worldToScreen } from '../geometry/transforms';
import { useMouseEvents } from './interaction/useMouseEvents';
import { ScaleBar } from '../components/HUD/ScaleBar';
import { CoordinateDisplay } from '../components/HUD/CoordinateDisplay';
import { ZoomControls } from '../components/HUD/ZoomControls';
import { BackgroundImagePanel } from '../components/BackgroundImagePanel';
import type { SnapResult } from '../types/tools';
import type { OpeningGhost } from './layers/openings';
import { distance } from '../geometry/point';

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

  // Inline text editing
  const editingTextLabelId = useStore(s => s.editingTextLabelId);
  const setEditingTextLabelId = useStore(s => s.setEditingTextLabelId);
  const updateTextLabel = useStore(s => s.updateTextLabel);
  const deleteTextLabel = useStore(s => s.deleteTextLabel);
  const [editingText, setEditingText] = useState('');

  // Background image state
  const backgroundImages = useStore(s => s.backgroundImages);
  const calibrationLine = useStore(s => s.calibrationLine);
  const setCalibrationLine = useStore(s => s.setCalibrationLine);
  const updateBackgroundImage = useStore(s => s.updateBackgroundImage);
  const setActiveTool = useStore(s => s.setActiveTool);

  const plan = activePlanId ? plans[activePlanId] : null;
  const backgroundImage = activePlanId ? (backgroundImages[activePlanId] ?? null) : null;

  // ─── Snap + rubber-band state from mouse handler ─────────────────────────
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const onSnapChange = useCallback((snap: SnapResult | null) => setSnapResult(snap), []);

  type RubberBandRect = { x1: number; y1: number; x2: number; y2: number };
  const [rubberBandRect, setRubberBandRect] = useState<RubberBandRect | null>(null);
  const onRubberBandChange = useCallback((rect: RubberBandRect | null) => setRubberBandRect(rect), []);

  const [openingGhost, setOpeningGhost] = useState<OpeningGhost | null>(null);
  const onOpeningGhostChange = useCallback((ghost: OpeningGhost | null) => setOpeningGhost(ghost), []);

  // ─── Calibration input state ──────────────────────────────────────────────
  const [calibLengthInput, setCalibLengthInput] = useState('');

  const confirmCalibration = useCallback(() => {
    const realCm = parseFloat(calibLengthInput);
    if (!realCm || realCm <= 0 || !activePlanId || !calibrationLine || !backgroundImage) return;
    const dx = calibrationLine.end.x - calibrationLine.start.x;
    const dy = calibrationLine.end.y - calibrationLine.start.y;
    const worldDist = Math.hypot(dx, dy);
    if (worldDist < 0.1) return;
    const pixelDist = worldDist / backgroundImage.cmPerPx;
    const newCmPerPx = realCm / pixelDist;
    updateBackgroundImage(activePlanId, { cmPerPx: newCmPerPx });
    setCalibrationLine(null);
    setCalibLengthInput('');
    setActiveTool('select');
  }, [calibLengthInput, activePlanId, calibrationLine, backgroundImage, updateBackgroundImage, setCalibrationLine, setActiveTool]);

  // Sync editing text when label changes
  useEffect(() => {
    if (!editingTextLabelId || !plan) { return; }
    const label = plan.textLabels.find(t => t.id === editingTextLabelId);
    if (label) setEditingText(label.text);
  }, [editingTextLabelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitTextEdit = useCallback(() => {
    if (!editingTextLabelId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      updateTextLabel(editingTextLabelId, { text: trimmed });
    } else {
      // Empty text → delete the label
      deleteTextLabel(editingTextLabelId);
    }
    setEditingTextLabelId(null);
  }, [editingTextLabelId, editingText, updateTextLabel, deleteTextLabel, setEditingTextLabelId]);

  const cancelTextEdit = useCallback(() => {
    if (!editingTextLabelId || !plan) { setEditingTextLabelId(null); return; }
    // If the label still has its placeholder text, it was just placed — remove it
    const label = plan.textLabels.find(t => t.id === editingTextLabelId);
    if (label?.text === 'Label') deleteTextLabel(editingTextLabelId);
    setEditingTextLabelId(null);
  }, [editingTextLabelId, plan, deleteTextLabel, setEditingTextLabelId]);

  const cancelCalibration = useCallback(() => {
    setCalibrationLine(null);
    setCalibLengthInput('');
    setActiveTool('select');
  }, [setCalibrationLine, setActiveTool]);

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
        activeTool,
        openingGhost,
        backgroundImage,
        calibrationLine,
        editingTextLabelId,
        ppcm: PPCM,
      });
    },
    [plan, settings, selectedIds, hoveredId, ghostPoint, wallChain, drawingState, showGrid, layers, pendingFurnitureTemplateId, snapResult, rubberBandRect, activeTool, openingGhost, backgroundImage, calibrationLine, editingTextLabelId]
  );

  const canvasRef = useCanvas(renderFn);

  // ─── Wire all mouse interaction ───────────────────────────────────────────
  useMouseEvents(canvasRef, onSnapChange, onRubberBandChange, onOpeningGhostChange);

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
        {/* HUD elements */}
        <ScaleBar />
        <CoordinateDisplay />
        <ZoomControls />

        {/* Background image panel — top-right of canvas */}
        <div className="absolute top-2 right-2 pointer-events-auto">
          <BackgroundImagePanel />
        </div>
      </div>

      {/* Inline text label editor */}
      {editingTextLabelId && plan && (() => {
        const label = plan.textLabels.find(t => t.id === editingTextLabelId);
        if (!label) return null;
        const sp = worldToScreen(label.position.x, label.position.y, plan.viewport, PPCM);
        const fontSizePx = Math.max(10, label.fontSize * PPCM * plan.viewport.zoom);
        return (
          <textarea
            autoFocus
            rows={1}
            value={editingText}
            onChange={e => setEditingText(e.target.value)}
            onBlur={commitTextEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelTextEdit(); }
            }}
            style={{
              position: 'absolute',
              left: sp.x,
              top: sp.y,
              fontSize: `${fontSizePx}px`,
              fontFamily: 'system-ui, sans-serif',
              color: label.color,
              minWidth: 80,
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #2563eb',
              borderRadius: 3,
              padding: '1px 3px',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.2,
              zIndex: 20,
            }}
          />
        );
      })()}

      {/* Calibration length input overlay — centered, blocks canvas interaction */}
      {calibrationLine && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-5 flex flex-col gap-3 min-w-64">
            <p className="text-sm font-medium text-gray-800">Set calibration length</p>
            <p className="text-xs text-gray-500">
              Line length:{' '}
              <span className="font-mono">
                {distance(calibrationLine.start, calibrationLine.end).toFixed(1)} world units
              </span>
            </p>
            <p className="text-xs text-gray-500">Enter the real-world length this line represents:</p>
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                type="number"
                min="0.1"
                step="1"
                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Length in cm"
                value={calibLengthInput}
                onChange={e => setCalibLengthInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCalibration();
                  if (e.key === 'Escape') cancelCalibration();
                }}
              />
              <span className="text-xs text-gray-500">cm</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelCalibration}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCalibration}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
