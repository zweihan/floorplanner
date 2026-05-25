import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import type { Point } from '../../types/plan';

/**
 * Attaches touch event handlers to the canvas for mobile/tablet support.
 * - Single-finger interactions are mapped to synthetic MouseEvents (mousedown, mousemove, mouseup, dblclick)
 *   to reuse existing mouse-based canvas tools with zero duplication.
 * - Two-finger gestures are intercepted and handled as pinch-to-zoom and two-finger panning.
 */
export function useTouchEvents(canvasRef: React.RefObject<HTMLCanvasElement>): void {
  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const setCamera = useStore(s => s.setCamera);

  // Maintain refs to avoid re-attaching touch listeners on every viewport/state change
  const stateRef = useRef({ activePlanId, plans, setCamera });
  stateRef.current = { activePlanId, plans, setCamera };

  // Gesture state tracking refs
  const lastTouchDist = useRef<number>(0);
  const lastTouchMidpoint = useRef<Point>({ x: 0, y: 0 });
  const isPinching = useRef<boolean>(false);
  const lastTapTime = useRef<number>(0);

  // Cache coordinates to dispatch mouseup at the correct final touch coordinates
  const lastTouchPos = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper: calculate distance between two touches
    const getTouchDist = (t1: Touch, t2: Touch): number => {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    };

    // Helper: calculate midpoint between two touches
    const getTouchMidpoint = (t1: Touch, t2: Touch): Point => {
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    };

    // Dispatch helper for synthetic MouseEvents
    const dispatchSyntheticMouse = (
      type: 'mousedown' | 'mousemove' | 'mouseup' | 'dblclick',
      clientX: number,
      clientY: number
    ) => {
      const mouseEvent = new MouseEvent(type, {
        clientX,
        clientY,
        button: 0,
        buttons: type === 'mouseup' ? 0 : 1,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(mouseEvent);
    };

    const onTouchStart = (e: TouchEvent) => {
      // Prevent browser interactions like page zoom/bounce
      e.preventDefault();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastTouchPos.current = { x: touch.clientX, y: touch.clientY };

        const now = Date.now();
        // Emulate double click/tap (within 300ms)
        if (now - lastTapTime.current < 300 && !isPinching.current) {
          dispatchSyntheticMouse('mousedown', touch.clientX, touch.clientY);
          dispatchSyntheticMouse('dblclick', touch.clientX, touch.clientY);
        } else {
          dispatchSyntheticMouse('mousedown', touch.clientX, touch.clientY);
        }
        lastTapTime.current = now;
      } else if (e.touches.length === 2) {
        // Multi-touch transition: cancel any active single-finger dragging/drawing cleanly first
        dispatchSyntheticMouse('mouseup', lastTouchPos.current.x, lastTouchPos.current.y);

        isPinching.current = true;
        lastTouchDist.current = getTouchDist(e.touches[0], e.touches[1]);
        lastTouchMidpoint.current = getTouchMidpoint(e.touches[0], e.touches[1]);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        // If we recently finished pinching, ignore single touchmove until all fingers are lifted
        if (isPinching.current) return;

        const touch = e.touches[0];
        lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
        dispatchSyntheticMouse('mousemove', touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        const { activePlanId, plans, setCamera } = stateRef.current;
        const plan = activePlanId ? plans[activePlanId] : null;
        if (!plan) return;

        const viewport = plan.viewport ?? { panX: 0, panY: 0, zoom: 1 };

        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const newMid = getTouchMidpoint(e.touches[0], e.touches[1]);

        // Pinch-to-zoom factor calculation
        const factor = newDist / (lastTouchDist.current || 1);
        const newZoom = Math.max(0.1, Math.min(8.0, viewport.zoom * factor));

        // Pan changes centered around the finger midpoint
        const newPanX = newMid.x - (newMid.x - viewport.panX) * (newZoom / viewport.zoom);
        const newPanY = newMid.y - (newMid.y - viewport.panY) * (newZoom / viewport.zoom);

        // Pan changes from fingers translation dragging
        const dx = newMid.x - lastTouchMidpoint.current.x;
        const dy = newMid.y - lastTouchMidpoint.current.y;

        setCamera({
          zoom: newZoom,
          panX: newPanX + dx,
          panY: newPanY + dy,
        });

        // Store current values for the next touchmove frame
        lastTouchDist.current = newDist;
        lastTouchMidpoint.current = newMid;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 0) {
        // All fingers lifted, finish gesture
        if (!isPinching.current) {
          dispatchSyntheticMouse('mouseup', lastTouchPos.current.x, lastTouchPos.current.y);
        }
        isPinching.current = false;
      } else if (e.touches.length === 1) {
        // Transitioning from 2 fingers back to 1.
        // We do NOT trigger synthetic mouse up/down yet to prevent accidental taps.
        // Keep pinching mode active until all fingers are lifted.
        isPinching.current = true;
      }
    };

    const onTouchCancel = (e: TouchEvent) => {
      e.preventDefault();
      if (!isPinching.current) {
        dispatchSyntheticMouse('mouseup', lastTouchPos.current.x, lastTouchPos.current.y);
      }
      isPinching.current = false;
    };

    // Attach listeners with passive: false to allow e.preventDefault()
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [canvasRef]);
}
