import { useRef, useEffect, useCallback } from 'react';

/**
 * Manages an HTML canvas element with HiDPI scaling and RAF-scheduled rendering.
 *
 * - Observes the canvas's parent container for size changes.
 * - Sets physical pixel dimensions based on devicePixelRatio.
 * - Calls renderFn via requestAnimationFrame; batches rapid changes into one frame.
 * - width/height passed to renderFn are CSS pixels — dpr scaling is transparent.
 */
export function useCanvas(
  renderFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): React.RefObject<HTMLCanvasElement> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Keep a stable ref to the latest renderFn so scheduleRender doesn't need it as a dep.
  const renderFnRef = useRef(renderFn);
  const sizeRef = useRef({ width: 0, height: 0 });

  renderFnRef.current = renderFn;

  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderFnRef.current(ctx, sizeRef.current.width, sizeRef.current.height);
    });
  }, []);

  // Watch parent container for resize; re-setup canvas pixel dimensions on change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applySize = (width: number, height: number) => {
      sizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Reset and apply dpr scale. This is the only place scale is applied —
        // setting canvas.width resets all context state first.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      scheduleRender();
    };

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      applySize(width, height);
    });

    const container = canvas.parentElement;
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, [scheduleRender]);

  // Re-render whenever renderFn identity changes (i.e. store state changed).
  useEffect(() => {
    scheduleRender();
  }, [renderFn, scheduleRender]);

  // Cancel pending RAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return canvasRef;
}
