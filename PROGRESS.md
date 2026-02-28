# FloorPlanner — Implementation Progress

## Status: R1/R2/R3 refactors complete — awaiting review

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
- [x] **Checkpoint 12 — Reference Image Tracing** ✅
- [x] **Checkpoint 13 — Annotations (Dimensions + Text)** ✅
- [x] **Checkpoint 14 — Export, Import & Multiple Plans** ✅
- [x] **Checkpoint 15 — Settings, Dark Theme & Polish** ✅
- [x] **PROPOSAL.md R3** — Removed dead `drawingState` / `hoveredId` from store, RenderState, CanvasContainer ✅
- [x] **PROPOSAL.md R2** — Added `renamePlan(id, name)` store action; fixed `PlanListModal` ✅
- [x] **PROPOSAL.md R1** — Split `useMouseEvents.ts` (869→294 lines) into 10 per-tool modules ✅

---

## Checkpoint 12 — Reference Image Tracing (DONE)

| File | What changed |
|------|--------------|
| `src/types/plan.ts` | Added `BackgroundImage` interface (`dataUrl`, `naturalWidth/Height`, `opacity`, `visible`, `offsetX/Y`, `cmPerPx`) |
| `src/types/tools.ts` | Added `'calibrate'` to `ToolType` union |
| `src/store/index.ts` | Added `backgroundImages: Record<string, BackgroundImage>` + `calibrationLine` to AppState; added `setBackgroundImage`, `updateBackgroundImage`, `setCalibrationLine` actions (not in undo history) |
| `src/canvas/layers/backgroundImage.ts` | `drawBackgroundImage` renders image at world position with opacity; `drawCalibrationLine` draws orange dashed reference line |
| `src/canvas/renderer.ts` | Step 1.5: draw background image before grid; step 14: draw calibration line |
| `src/canvas/CanvasContainer.tsx` | Passes `backgroundImage` + `calibrationLine` to renderer; renders calibration length input modal overlay |
| `src/canvas/interaction/useMouseEvents.ts` | `calibrate` tool: first click sets chain start, second click commits `calibrationLine` |
| `src/components/BackgroundImagePanel.tsx` | Floating top-right panel: upload button when no image; eye toggle + opacity slider + calibrate + replace + clear when image loaded |

Build: `tsc --noEmit` clean, `vite build` TBD, 120/120 tests.

What you should see running `npm run dev`:

- Top-right of canvas: **"Ref Image"** button
- Click → file picker opens; select any JPG/PNG floor plan image
- Image appears in canvas background at 40% opacity, scaled to fill viewport width
- App automatically switches to **calibrate mode** (cursor changes, orange dot appears on first click)
- Click two points that span a known real-world distance (e.g. a wall you know is 300 cm)
- A dialog appears: enter `300` → click **Apply**
- Image rescales so those two points are exactly 300 cm apart
- Draw walls over the image to trace the floor plan
- Use the **eye icon** to toggle image visibility while working
- Drag the **opacity slider** to make the image more/less visible (5–100%)
- Click **Calibrate** again to re-draw the reference line; click **×** to remove the image

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

## Checkpoint 13 — Annotations (Dimensions + Text) (DONE)

| File | What changed |
|------|--------------|
| `src/canvas/layers/dimensions.ts` | `drawDimensions` + `drawDimensionGhost`: extension lines, filled arrowheads, centered label; auto-skip < 40 px screen |
| `src/canvas/layers/textLabels.ts` | `drawTextLabels`: renders text at world position with font/color/alignment; skips label being inline-edited |
| `src/canvas/layers/dimensions.test.ts` | 4 unit tests for perpendicular offset geometry (canvas y-down convention) |
| `src/store/index.ts` | Added `editingTextLabelId` (not in undo history) + `setEditingTextLabelId` action |
| `src/canvas/renderer.ts` | Steps 8/9: dimensions + text labels; step 11d: dimension placement ghost |
| `src/canvas/CanvasContainer.tsx` | Inline `<textarea>` overlay for text editing (auto-focus, Enter commits, Escape cancels); passes `editingTextLabelId` to renderer |
| `src/canvas/interaction/useMouseEvents.ts` | Dimension tool (M): 2-click places line at 12 cm offset; Text tool (T): click places label + opens inline editor; Eraser (E): drag accumulates hit IDs, single `deleteElements` on mouseup; double-click on text label opens editor |
| `src/components/PropertiesPanel.tsx` | `DimensionProperties` (measured length, offset, override text) + `TextLabelProperties` (edit button, font size, alignment, color) |

Build: `tsc --noEmit` clean, 124/124 tests.

What you should see running `npm run dev`:

- Press **M** → dimension tool; click two points → dimension line appears with extension lines, arrows, and measured length label
- Press **T** → text tool; click anywhere → "Label" text placed + inline text editor opens (type and press Enter)
- Double-click any text label → inline editor opens for editing; press Enter/blur to commit, Escape to cancel (empty text deletes label)
- Press **E** → eraser tool; click or drag over walls, furniture, openings, dimensions, text labels to delete them (single undo entry per drag)
- Select a dimension line → Properties panel shows its length + offset + optional override text
- Select a text label → Properties panel shows font size, alignment, color; click Edit to open inline editor

---

## Checkpoint 14 — Export, Import & Multiple Plans (DONE)

| File | What changed |
|------|--------------|
| `src/canvas/export.ts` | `exportPNG(plan, settings, scale)` — tight-bounds off-screen canvas render at 1×/2×/4×, downloads file |
| `src/store/index.ts` | `exportJSON()` serializes active plan with `{schemaVersion:1, plan}`; `importJSON(json)` validates + imports as new plan |
| `src/components/ExportMenu.tsx` | Dropdown button in header: PNG 1×/2×/4×, Export JSON, Import JSON (file picker) |
| `src/components/PlanListModal.tsx` | Modal: list of plans with click-to-switch, double-click-to-rename, delete, + New Plan input |
| `src/App.tsx` | Header now has inline plan name editor (double-click), plan switcher button, ExportMenu; PlanListModal wired |
| `src/store/crud.test.ts` | 8 new tests: newPlan (3), deletePlan (2), importJSON round-trip (3) |

Build: `tsc --noEmit` clean, 132/132 tests.

What you should see running `npm run dev`:

- Header shows plan name; **double-click** plan name → inline input to rename; Enter/blur commits
- Click **▾** next to plan name → PlanListModal opens; lists all plans; click to switch; double-click row to rename; ✕ to delete; + New Plan to create
- Click **Export ▾** in header → dropdown with PNG 1×/2×/4×, Export JSON, Import JSON…
- Export PNG → off-screen render (no grid, no selection handles, tight crop + 20 cm padding) downloads as `{name}_{scale}x.png`
- Export JSON → downloads `{name}.json` with `schemaVersion:1` wrapper
- Import JSON → file picker; loads plan into store; switches to it; shows toast on success/error

---

## Checkpoint 15 — Settings, Dark Theme & Polish (DONE)

| File | What changed |
|------|--------------|
| `src/components/SettingsModal.tsx` | New modal: dark theme toggle, display unit, wall thickness, grid size, show-dimensions toggle, all 4 snap toggles |
| `src/App.tsx` | Toggles `dark` class on `<html>` via `useEffect` when `settings.theme` changes; gear ⚙ button in header opens SettingsModal; `SettingsModal` imported and rendered |
| `src/styles/index.css` | Added `.dark` CSS overrides for `.fp-toolbar`, `.fp-statusbar`, `.fp-panel` shells (bg, border, color, input colors) |
| `src/hooks/usePlanPersistence.ts` | On first mount: if viewport is at factory default (pan=0, zoom=1), calls `fitToScreen` with estimated canvas size |

Note: E2E Playwright tests skipped — Playwright not configured in this project. All 132 unit tests pass.

Build: `tsc --noEmit` clean, 132/132 tests.

What you should see running `npm run dev`:

- Click **⚙** (gear) in header → SettingsModal opens with sections for Appearance, Units, Drawing Defaults, Snapping
- Toggle **Dark theme** → entire UI switches: canvas background → dark, grid → darker, app shell → dark gray
- Change **Display unit** (cm/m/ft) → measurement labels throughout update
- Change **Wall thickness** / **Grid size** → persists and applies to new elements
- Toggle **Snap to grid / endpoints / midpoints / angle** → affects snapping behavior immediately
- On fresh load (no saved viewport): canvas auto-fits the plan bounds into the viewport

---

---

## Checkpoint 16 — Polish & Gap Closure (IN PROGRESS)

| Task | File | What changed |
|------|------|--------------|
| ✅ Toolbar icons | `src/App.tsx` | `TOOL_META` array with lucide-react icons; icon buttons with `aria-label` + `title` key hints |
| ✅ PropertiesPanel fields | `src/components/PropertiesPanel.tsx` | Wall: editable start/end X/Y coordinates via `updateWallEndpoints`; Document: Width/Height fields; Furniture: Position X/Y inputs + Lock checkbox |
| ✅ Keyboard shortcuts | `src/canvas/interaction/useKeyboardShortcuts.ts` | `Ctrl+E` → export PNG 1×; `Ctrl+Shift+F` → fit to screen |
| ⬜ Cascade-delete toasts | `src/store/index.ts` | Toast when deleting a wall removes attached openings |
| ⬜ Layer Panel UI | `src/components/LayerPanel.tsx` | Eye/lock toggles per layer |
| ⬜ Furniture Panel accordion | `src/components/FurniturePanel.tsx` | Group templates by `category` in collapsible sections |

Build: `tsc --noEmit` clean, 132/132 tests.

---

## Next steps (post-Checkpoint 15)

The project is now feature-complete per the original spec. Potential polish:
- PropertiesPanel + FurniturePanel internal dark-mode class updates (currently CSS selector `.fp-panel` handles most of it via parent)
- E2E Playwright test suite (wall drawing, selection, persistence)
- Keyboard shortcut for Settings (e.g. `,`)
- Accessibility audit (ARIA labels, keyboard nav in modals)
