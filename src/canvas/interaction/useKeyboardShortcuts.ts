import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { exportPNG } from '../export';
import type { ToolType } from '../../types/tools';
import type { Point } from '../../types/plan';

/**
 * Global keyboard shortcut handler. Must be called once in App.tsx.
 * Guards against firing when focus is inside an input or textarea.
 */
export function useKeyboardShortcuts(): void {
  const setActiveTool = useStore(s => s.setActiveTool);
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const clearChain = useStore(s => s.clearChain);
  const deleteElements = useStore(s => s.deleteElements);
  const selectAll = useStore(s => s.selectAll);
  const toggleShowGrid = useStore(s => s.toggleShowGrid);
  const toggleSnapToGrid = useStore(s => s.toggleSnapToGrid);
  const forceSave = useStore(s => s.forceSave);
  const zoomIn = useStore(s => s.zoomIn);
  const zoomOut = useStore(s => s.zoomOut);
  const setCamera = useStore(s => s.setCamera);
  const setSelectedIds = useStore(s => s.setSelectedIds);
  const fitToScreen = useStore(s => s.fitToScreen);

  // Reactive values read by handlers
  const activeTool = useStore(s => s.activeTool);
  const selectedIds = useStore(s => s.selectedIds);
  const wallChain = useStore(s => s.wallChain);

  const stateRef = useRef<{ activeTool: ToolType; selectedIds: string[]; wallChain: Point[] }>({
    activeTool,
    selectedIds,
    wallChain,
  });
  stateRef.current = { activeTool, selectedIds, wallChain };

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');

    const handleEscape = () => {
      const { activeTool, wallChain, selectedIds } = stateRef.current;
      if (activeTool === 'wall' && wallChain.length > 0) {
        clearChain();
      } else if (selectedIds.length > 0) {
        setSelectedIds([]);
      } else {
        setActiveTool('select');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;

      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'a':
            e.preventDefault();
            selectAll();
            break;
          case 's':
            e.preventDefault();
            forceSave();
            break;
          case '=': case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            e.preventDefault();
            setCamera({ zoom: 1.0, panX: 0, panY: 0 });
            break;
          case 'e':
            e.preventDefault();
            {
              const { plans, activePlanId, settings } = useStore.getState();
              const plan = activePlanId ? plans[activePlanId] : null;
              if (plan) exportPNG(plan, settings);
            }
            break;
          case 'f':
            if (e.shiftKey) {
              e.preventDefault();
              const canvas = document.querySelector('canvas');
              fitToScreen(canvas?.clientWidth ?? window.innerWidth, canvas?.clientHeight ?? window.innerHeight);
            }
            break;
        }
        return;
      }

      // Non-ctrl shortcuts (ignore if shift is held with letters to avoid conflicts)
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case 'w': setActiveTool('wall'); break;
        case 'r': setActiveTool('room'); break;
        case 'd': setActiveTool('door'); break;
        case 'n': setActiveTool('window'); break;
        case 'o': setActiveTool('opening'); break;
        case 'f': setActiveTool('furniture'); break;
        case 'h': setActiveTool('pan'); break;
        case 'm': setActiveTool('dimension'); break;
        case 't': setActiveTool('text'); break;
        case 'e': setActiveTool('eraser'); break;
        case 'g': toggleShowGrid(); break;
        case 's': toggleSnapToGrid(); break;
        case 'escape': handleEscape(); break;
        case 'delete':
        case 'backspace': {
          const { selectedIds } = stateRef.current;
          if (selectedIds.length > 0) deleteElements(selectedIds);
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setActiveTool, undo, redo, clearChain, deleteElements, selectAll,
    toggleShowGrid, toggleSnapToGrid, forceSave, zoomIn, zoomOut,
    setCamera, setSelectedIds, fitToScreen,
  ]);
}
