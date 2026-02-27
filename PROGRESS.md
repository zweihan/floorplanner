# FloorPlanner — Implementation Progress

## Status: Checkpoint 5 complete — awaiting review

## Completed

- [x] Spec finalized (`FINAL_PROJECT.md`, 2414 lines)
- [x] Claude Code automations (context7, Playwright MCP, skills, hooks, subagent)
- [x] **Checkpoint 1 — Project Scaffold** ✅
- [x] **Checkpoint 2 — Core Canvas** ✅
- [x] **Checkpoint 3 — Wall Drawing** ✅
- [x] **Checkpoint 4 — HUD + Persistence** ✅
- [x] **Checkpoint 5 — Selection & Editing** ✅

## Checkpoint 4 — HUD + Persistence (DONE)

| File | What it does |
|------|-------------|
| `src/components/HUD/ScaleBar.tsx` | Scale bar bottom-left; nice-number algorithm (§8.6) |
| `src/components/HUD/CoordinateDisplay.tsx` | World cursor coords bottom-right (hides when no ghost point) |
| `src/components/HUD/ZoomControls.tsx` | [−] [100%] [+] buttons, click % resets zoom |
| `src/components/ToastContainer.tsx` | Fixed bottom-right toast stack; info/warning/error colours; click to dismiss |
| `src/hooks/usePlanPersistence.ts` | 500 ms debounced localStorage saves + `beforeunload` instant save |
| `src/canvas/CanvasContainer.tsx` | HUD overlay wired: `<ScaleBar>`, `<CoordinateDisplay>`, `<ZoomControls>` |
| `src/App.tsx` | `usePlanPersistence()` called; `<ToastContainer />` rendered; StatusBar coord display removed |

Build: `tsc --noEmit` clean, `vite build` 171 KB.

What you should see running `npm run dev`:
- Bottom-left: live scale bar (e.g. "50 cm") scales as you zoom
- Bottom-right: `[−] [100%] [+]` zoom controls; click `100%` to reset view
- While drawing walls: cursor world coords appear above zoom controls
- Auto-saves to localStorage 500 ms after any plan change
- Red toast appears bottom-right if localStorage is full

## Checkpoint 3 — Wall Drawing (DONE)

| File | What it does |
|------|-------------|
| `src/geometry/point.ts` | `distance`, `midpoint`, `lerp`, `normalize`, `dot`, `perpendicular` |
| `src/geometry/segment.ts` | `segmentLength`, `segmentAngle`, `nearestPointOnSegment`, `pointToSegmentDist` |
| `src/geometry/units.ts` | `cmToUnit`, `unitToCm`, `formatMeasurement`, `parseImperialInput` (spec §10.2) |
| `src/geometry/snapping.ts` | `snapToGrid`, `snapToEndpoints`, `snapToMidpoints`, `snapToAngle`, `applySnapping` (spec §10.2 exact impl) |
| `src/canvas/layers/preview.ts` | Ghost wall segment (dashed, semi-transparent) + length badge |
| `src/canvas/layers/labels.ts` | Wall length labels at midpoint, upright orientation, skips < 40 px |
| `src/canvas/layers/snapIndicators.ts` | Endpoint (circle), midpoint (diamond), angle/grid (crosshair) in green |
| `src/canvas/interaction/useMouseEvents.ts` | All mouse events via raw listeners: wall chain, pan (Space+drag / middle), ghost point |
| `src/canvas/interaction/useKeyboardShortcuts.ts` | W/V/R/D/N/F/M/T/E/G/S, Escape, Delete, Ctrl+Z/Y, Ctrl+A/S/±/0 |
| `src/canvas/renderer.ts` | Updated: labels, preview, snap indicators wired in |
| `src/canvas/CanvasContainer.tsx` | Simplified: delegates all mouse to `useMouseEvents`; snapResult flows to renderer |
| `src/App.tsx` | `useKeyboardShortcuts()` called at app root |

Build: `tsc --noEmit` clean, `vite build` 168 KB.

What you should see running `npm run dev`:
- Press **W** → wall tool (crosshair cursor)
- Click to start a chain, move cursor → ghost wall with length badge follows
- Green circle snaps to wall endpoints; grid snap active by default
- Click again → wall committed, labeled, chain continues
- **Double-click** or **right-click** or **Escape** → end chain
- Walls labeled with length (e.g. "150 cm")
- **Ctrl+Z** / **Ctrl+Y** → undo/redo
- **G** toggles grid; **S** toggles snap

## Checkpoint 4 — HUD + Persistence Polish (next)

Tasks:
- [x] `src/components/HUD/CoordinateDisplay.tsx` ✅
- [x] `src/components/HUD/ZoomControls.tsx` ✅
- [x] `src/components/HUD/ScaleBar.tsx` ✅
- [x] `src/hooks/usePlanPersistence.ts` ✅
- [x] `src/components/ToastContainer.tsx` ✅
- [x] Wire HUD overlay into `CanvasContainer` ✅
- [ ] Fit-to-screen on first load (deferred to Checkpoint 5)

## Checkpoint 5 — Selection & Editing (DONE)

| File | What it does |
|------|-------------|
| `src/geometry/hitTest.ts` | `hitTestWall/Room/Furniture/Dimension/TextLabel/Plan/PlanInRect` + `BBox` type |
| `src/canvas/layers/selection.ts` | Blue dashed outline + endpoint/midpoint handles per spec §8.5b |
| `src/store/index.ts` | `setActivePlanNoHistory` (live drag preview) + `updateWallEndpoints` (joined-wall commit) |
| `src/canvas/renderer.ts` | Selection layer + rubber-band rect rendering; `rubberBandRect` added to `RenderState` |
| `src/canvas/CanvasContainer.tsx` | `rubberBandRect` state + `onRubberBandChange` callback wired to `useMouseEvents` |
| `src/canvas/interaction/useMouseEvents.ts` | Full select tool: click, shift-click, rubber-band, drag-move, wall endpoint drag with auto-join |

Build: `tsc --noEmit` clean, `vite build` 179 KB.

What you should see running `npm run dev`:
- Press **V** (or start in select mode) — click a wall → blue dashed outline + endpoint squares + midpoint square
- **Shift+click** to add/remove from selection
- **Drag a wall** → moves it (snaps to grid); Ctrl+Z undoes as one action
- **Drag an endpoint** → reshapes the wall; joined walls follow automatically
- **Drag on empty canvas** → rubber-band selection (blue dashed rect); release selects all overlapping elements
- **Delete** key → deletes selected elements (handled by keyboard shortcuts)

## Phase 2–4 (future)

See FINAL_PROJECT.md §Phase 2, 3, 4 for full breakdown.

---

_Last updated: Checkpoint 5 complete_
