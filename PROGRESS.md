# FloorPlanner — Implementation Progress

## Status: Checkpoint 11 complete — awaiting review

## Completed

- [x] Spec finalized (`FINAL_PROJECT.md`, 2414 lines)
- [x] Claude Code automations (context7, Playwright MCP, skills, hooks, subagent)
- [x] **Checkpoint 1 — Project Scaffold** ✅
- [x] **Checkpoint 2 — Core Canvas** ✅
- [x] **Checkpoint 3 — Wall Drawing** ✅
- [x] **Checkpoint 4 — HUD + Persistence** ✅
- [x] **Checkpoint 5 — Selection & Editing** ✅
- [x] **Checkpoint 6 — Properties Panel** ✅
- [x] **Checkpoint 7 — Room Tool** ✅
- [x] **Checkpoint 8 — Wall Length Editing** ✅
- [x] **Checkpoint 9 — Openings (Doors & Windows)** ✅
- [x] **Checkpoint 10 — Furniture** ✅
- [x] **Checkpoint 11 — Pan Tool, Opening Properties & Passages** ✅

---

## Checkpoint 10 — Furniture (DONE)

| File | What changed |
|------|--------------|
| `src/data/furnitureTemplates.ts` | `FurnitureTemplate` interface + 10 templates (sofa→fridge) with default dims + colors |
| `src/components/FurniturePanel.tsx` | Sidebar panel (shown when tool=furniture): 2-col emoji grid, click selects/deselects template |
| `src/canvas/layers/furniture.ts` | `drawFurniture`, `drawFurnitureGhost`; `_drawShape` renders architectural symbols per templateId |
| `src/canvas/layers/selection.ts` | Added furniture handles: dashed rotated outline + 4 corner squares + rotation circle (8px, 24px above top) |
| `src/canvas/renderer.ts` | Step 4: `drawFurniture`; step 11c: furniture ghost (uses `ghostPoint` + `pendingFurnitureTemplateId`) |
| `src/canvas/interaction/useMouseEvents.ts` | Furniture tool: click-to-place; select tool: rotation drag + corner resize drag (single history entry on release) |
| `src/App.tsx` | `<FurniturePanel />` rendered when `activeTool === 'furniture'` |
| `src/geometry/hitTest.test.ts` | 3 new `hitTestFurniture` tests for 45° rotated item |

Build: `tsc --noEmit` clean, `vite build` 204 KB, 120/120 tests.

What you should see running `npm run dev`:

- Press **F** → furniture tool; panel slides in on left showing 10 item types with emoji icons
- Click a furniture type (e.g. Sofa), then move cursor over canvas → ghost preview at cursor
- Click on canvas → item placed with architectural symbol; undo/redo works
- Switch to select, click a furniture item → dashed rotated outline + 4 corner handles + rotation circle above
- Drag a corner handle → resizes symmetrically about center
- Drag the rotation circle → rotates item; Shift snaps to 15° increments
- Select and drag item body → moves it (existing drag-move behavior)

---

## Checkpoint 9 — Openings (Doors & Windows) (DONE)

| File | What changed |
|------|--------------|
| `src/geometry/hitTest.ts` | Added `hitTestWallForOpening(wall, p, threshold)` — projects point onto wall, returns t ∈ [0,1] or null |
| `src/canvas/layers/walls.ts` | Now accepts `openings` list; computes gap intervals per opening, draws solid segments only |
| `src/canvas/layers/openings.ts` | New: `drawOpenings` (door arc + window glass + sliding/double symbols) + `drawOpeningGhost` |
| `src/canvas/renderer.ts` | `openingGhost` added to `RenderState`; openings layer wired (step 7); ghost preview (step 11b) |
| `src/canvas/CanvasContainer.tsx` | `openingGhost` state + `onOpeningGhostChange` callback; `activeTool` added to renderFn deps |
| `src/canvas/interaction/useMouseEvents.ts` | Door (D) + Window (N) tools: hover ghost on wall, click to place; `addOpening` action wired |
| `src/store/crud.test.ts` | Added cascade-delete test: `deleteElements([wallId])` removes attached openings |
| `src/geometry/hitTest.test.ts` | 5 new tests for `hitTestWallForOpening` (t value, threshold, out-of-bounds) |

Build: `tsc --noEmit` clean, `vite build` 195 KB, 117/117 tests.

What you should see running `npm run dev`:

- Press **D** → door tool; hover over any wall → blue dashed ghost shows placement position
- Click → door placed; wall shows gap with door leaf line + swing arc symbol
- Press **N** → window tool; click on wall → window placed with parallel glass-line symbol
- Double doors and sliding doors placed via opening type property in Properties Panel
- **Ctrl+Z** undoes door/window placement
- Deleting a wall also deletes all its attached doors/windows

---

## Checkpoint 8 — Wall Length Editing (DONE)

| File | What changed |
|------|--------------|
| `src/geometry/units.ts` | Added `parseLength(input, unit)` — parses cm/m/ft-in strings to cm |
| `src/store/index.ts` | Added `setWallLength(id, newLengthCm)` — moves end endpoint + auto-updates joined walls in one history entry |
| `src/components/PropertiesPanel.tsx` | Length field is now an editable input; shows formatted value at rest, raw number on focus; commits on Enter/blur |
| `src/store/crud.test.ts` | 5 new tests: direction preservation, diagonal wall, one history entry, joined-wall propagation, degenerate no-op |

Build: `tsc --noEmit` clean, `vite build` 192 KB, 111/111 tests.

What you should see running `npm run dev`:

- Click a wall → Length field shows e.g. "150 cm" (editable)
- Click the field → shows "150.0", type a new value, press Enter
- End endpoint moves along the wall's direction; joined walls follow automatically
- **Ctrl+Z** undoes the entire length change in one step

---

## Checkpoint 7 — Room Tool (DONE)

| File | What it does |
|------|--------------|
| `src/geometry/polygon.ts` | `shoelaceArea`, `polygonCentroid`, `pointInPolygon` |
| `src/store/index.ts` | `addRoom`, `updateRoom`, `deleteRoom` actions |
| `src/canvas/layers/rooms.ts` | Filled polygon + area label at centroid; skip label < 40 px |
| `src/canvas/interaction/useMouseEvents.ts` | Room tool (R): click to add polygon vertices, double-click/Enter to close |
| `src/canvas/renderer.ts` | Wire in rooms layer (below walls) |

Room auto-creation from closed wall chain deferred to Phase 3.

---

## Checkpoint 6 — Properties Panel (DONE)

| File | What it does |
|------|--------------|
| `src/components/PropertiesPanel.tsx` | WallProperties (length/thickness/layer/color/coords) + DocumentProperties (name/unit/grid) + MultiSelectProperties (count + delete) |
| `src/store/crud.test.ts` | 7 tests: updateWall patching, history entry, layer/color changes; updateDocument name/gridSize/unit |
| `tsconfig.json` | Added `"types": ["vitest/globals"]` so `tsc --noEmit` sees vitest globals |

Build: `tsc --noEmit` clean, `vite build` 185 KB, 96/96 tests.

---

## Checkpoint 5 — Selection & Editing (DONE)

| File | What it does |
|------|--------------|
| `src/geometry/hitTest.ts` | `hitTestWall/Room/Furniture/Dimension/TextLabel/Plan/PlanInRect` + `BBox` type |
| `src/canvas/layers/selection.ts` | Blue dashed outline + endpoint/midpoint handles per spec §8.5b |
| `src/store/index.ts` | `setActivePlanNoHistory` (live drag preview) + `updateWallEndpoints` (joined-wall commit) |
| `src/canvas/renderer.ts` | Selection layer + rubber-band rect rendering; `rubberBandRect` added to `RenderState` |
| `src/canvas/CanvasContainer.tsx` | `rubberBandRect` state + `onRubberBandChange` callback wired to `useMouseEvents` |
| `src/canvas/interaction/useMouseEvents.ts` | Full select tool: click, shift-click, rubber-band, drag-move, wall endpoint drag with auto-join |

Build: `tsc --noEmit` clean, `vite build` 179 KB.

---

## Checkpoint 4 — HUD + Persistence (DONE)

| File | What it does |
|------|--------------|
| `src/components/HUD/ScaleBar.tsx` | Scale bar bottom-left; nice-number algorithm (§8.6) |
| `src/components/HUD/CoordinateDisplay.tsx` | World cursor coords bottom-right (hides when no ghost point) |
| `src/components/HUD/ZoomControls.tsx` | [−] [100%] [+] buttons, click % resets zoom |
| `src/components/ToastContainer.tsx` | Fixed bottom-right toast stack; info/warning/error colours; click to dismiss |
| `src/hooks/usePlanPersistence.ts` | 500 ms debounced localStorage saves + `beforeunload` instant save |
| `src/canvas/CanvasContainer.tsx` | HUD overlay wired: `<ScaleBar>`, `<CoordinateDisplay>`, `<ZoomControls>` |
| `src/App.tsx` | `usePlanPersistence()` called; `<ToastContainer />` rendered |

Build: `tsc --noEmit` clean, `vite build` 171 KB.

---

## Checkpoint 3 — Wall Drawing (DONE)

| File | What it does |
|------|--------------|
| `src/geometry/point.ts` | `distance`, `midpoint`, `lerp`, `normalize`, `dot`, `perpendicular` |
| `src/geometry/segment.ts` | `segmentLength`, `segmentAngle`, `nearestPointOnSegment`, `pointToSegmentDist` |
| `src/geometry/units.ts` | `cmToUnit`, `unitToCm`, `formatMeasurement`, `parseImperialInput` (spec §10.2) |
| `src/geometry/snapping.ts` | `snapToGrid`, `snapToEndpoints`, `snapToMidpoints`, `snapToAngle`, `applySnapping` (spec §10.2) |
| `src/canvas/layers/preview.ts` | Ghost wall segment (dashed, semi-transparent) + length badge |
| `src/canvas/layers/labels.ts` | Wall length labels at midpoint, upright orientation, skips < 40 px |
| `src/canvas/layers/snapIndicators.ts` | Endpoint (circle), midpoint (diamond), angle/grid (crosshair) in green |
| `src/canvas/interaction/useMouseEvents.ts` | All mouse events via raw listeners: wall chain, pan (Space+drag / middle), ghost point |
| `src/canvas/interaction/useKeyboardShortcuts.ts` | W/V/R/D/N/F/M/T/E/G/S, Escape, Delete, Ctrl+Z/Y, Ctrl+A/S/±/0 |
| `src/canvas/renderer.ts` | Labels, preview, snap indicators wired in |

Build: `tsc --noEmit` clean, `vite build` 168 KB.

---

## Checkpoint 11 — Pan Tool, Opening Properties & Passages (DONE)

| File | What changed |
|------|--------------|
| `src/types/plan.ts` | Added `'opening'` to `Opening['type']` union |
| `src/canvas/layers/openings.ts` | Added `'opening'` case: plain jamb lines only (no arc, no glass) |
| `src/canvas/renderer.ts` | Ghost condition extended to include `activeTool === 'opening'` |
| `src/canvas/interaction/useMouseEvents.ts` | Pan tool: left-drag pans canvas (no Space needed); `'opening'` tool handled like door/window; grab cursor set via useEffect |
| `src/canvas/interaction/useKeyboardShortcuts.ts` | Added `O` → opening tool, `H` → pan tool |
| `src/App.tsx` | Added `'opening'` between window and furniture in toolbar |
| `src/components/PropertiesPanel.tsx` | Added `OpeningProperties` (type, width, height, open angle, flip side) + `FurnitureProperties` (label, width, depth, rotation, color); both wired into root panel dispatch |

Build: `tsc --noEmit` clean, `vite build` 211 KB, 120/120 tests.

What you should see running `npm run dev`:

- Press **H** → pan tool; cursor becomes a hand; drag to pan without holding Space
- Press **O** (or click O in toolbar) → opening tool; click on a wall → plain rectangular passage (jamb lines only, no arc/glass)
- Click any door, window, or opening → Properties panel shows the opening type, width, height, open angle, and flip-side toggle
- Change width in Properties → wall gap updates immediately; undo/redo works
- Change type in Properties (e.g. door → sliding-door) → symbol changes on canvas
- Click a furniture item → Properties panel shows label, width, depth, rotation, and color

---

## Checkpoint 12 — Annotations (Dimensions + Text) [NEXT]

| File | What it does |
|------|--------------|
| `src/canvas/layers/dimensions.ts` | Dimension line rendering: extension lines, arrow heads, centered label (§F7.2); auto-skip < 40 px |
| `src/canvas/layers/textLabels.ts` | Render text labels with font/color/alignment |
| `src/canvas/interaction/useMouseEvents.ts` | Dimension tool (M): click start, click end, drag offset; Text tool (T): click to place |
| Inline editing | DOM `<textarea>` overlay on double-click; commit on Enter/blur, cancel on Escape (§F8.4) |
| Eraser tool (E) | Click or drag over elements to delete them one-by-one |

Tests: dimension offset computation, `formatMeasurement` round-trip.

---

## Checkpoint 13 — Export, Import & Multiple Plans

| File | What it does |
|------|--------------|
| `src/canvas/export.ts` | `exportPNG(plan, scale)` — off-screen canvas render at 1×/2×/4× |
| `src/store/index.ts` | `exportJSON`, `importJSON` (validate schema, merge or replace) |
| `src/components/ExportMenu.tsx` | Dropdown: Export PNG (1×/2×/4×), Export JSON, Import JSON |
| `src/components/PlanListModal.tsx` | Plan list with New / Rename / Delete / Switch |

Tests: `newPlan`, `deletePlan`, `importJSON` round-trip.

---

## Checkpoint 14 — Settings, Dark Theme & Polish

| File | What it does |
|------|--------------|
| `src/components/SettingsModal.tsx` | Unit, default wall thickness, grid size, snap toggles, theme toggle |
| `src/store/index.ts` | `updateSettings` action; settings persisted in `localStorage` |
| `src/canvas/renderer.ts` + CSS | Dark theme: canvas background #1a1a1a, grid #2a2a2a; CSS variables via `data-theme` |
| Header inline edit | Double-click plan name in header → inline `<input>`, commit on Enter/blur |
| Fit-to-screen on first load | Call `fitToScreen` in `usePlanPersistence` when loading plan with no saved viewport |

E2E tests: wall drawing, selection, persistence (Playwright).
