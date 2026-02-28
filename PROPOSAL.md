# Refactoring Proposals

Findings from a full codebase review. Ordered by impact (highest first).

---

## R1 · Split `useMouseEvents.ts` into per-tool modules (High impact) ✅ DONE

**File:** `src/canvas/interaction/useMouseEvents.ts` (869 lines)

**Problem.** A single 869-line hook with a giant `onMouseDown` if-chain dispatching on
`activeTool`. Adding a tool, changing a tool's click behaviour, or testing tool logic all
require editing the same file. The drag state refs (`furnitureResizeRef`,
`endpointDragRef`, `elementDragRef`, …) are scattered across the same scope.

**Proposal.** Extract each tool into a self-contained module that exports a handler object:

```
src/canvas/interaction/tools/
  wallTool.ts       → { onMouseDown, onMouseMove, onMouseUp }
  roomTool.ts
  openingTool.ts    → door / window / opening share one module
  furnitureTool.ts
  selectTool.ts     → contains rubber-band, element drag, endpoint drag, furniture handles
  eraserTool.ts
  dimensionTool.ts
  textTool.ts
  calibrateTool.ts
  panTool.ts
```

`useMouseEvents.ts` becomes a thin router (~80 lines) that:
1. Instantiates a `Map<ToolType, ToolHandler>` from the above modules.
2. Delegates to `handlers.get(activeTool)?.onMouseDown(e)` etc.
3. Owns only the pan-override logic (middle-mouse / Space-hold) before delegating.

**Benefits.**
- Each tool is independently readable, testable, and modifiable.
- New tools are additive changes (new file + one-line registration).
- Drag state is scoped to the module that owns it.

---

## R2 · Add a `renamePlan` store action; remove the `switchPlan` hack (High impact) ✅ DONE

**File:** `src/components/PlanListModal.tsx` (lines ~38–43), `src/store/index.ts`

**Problem.** To rename a non-active plan, `PlanListModal` temporarily switches to it,
calls `updateDocument`, then switches back:

```ts
switchPlan(id);
updateDocument({ name: trimmed });
if (prevActive && prevActive !== id) switchPlan(prevActive);
```

This creates spurious state transitions (undo history cleared twice, active plan
flickering) and will produce bugs if the surrounding code ever becomes async.

**Proposal.** Add a dedicated `renamePlan(id: string, name: string)` action:

```ts
renamePlan: (id, name) => {
  set(s => ({
    plans: {
      ...s.plans,
      [id]: { ...s.plans[id], name, updatedAt: new Date().toISOString() },
    },
  }));
},
```

`PlanListModal.commitRename` calls `renamePlan(id, name)` directly, regardless of which
plan is active. No side-effects on undo history or active plan.

---

## R3 · Remove dead state: `drawingState` and `hoveredId` (Medium impact) ✅ DONE

**Files:** `src/store/index.ts`, `src/types/tools.ts`, `src/canvas/renderer.ts`,
`src/canvas/CanvasContainer.tsx`

**Problem.**
- `drawingState: DrawingState | null` is always `null`. `setDrawingState` is never
  called by any interaction handler. It is passed through `RenderState` to the renderer
  but nothing reads it.
- `hoveredId: string | null` is in `AppState` and `RenderState`, but `setHoveredId` is
  never called. It is always `null`.

Both fields exist as scaffolding from the spec that was never implemented.

**Proposal.**
1. Remove `drawingState` from `AppState`, `RenderState`, and `CanvasContainer`.
2. Remove `hoveredId` from `AppState`, `RenderState`, and `CanvasContainer`.
3. Remove the corresponding interface declarations from `types/tools.ts` (`DrawingState`).
4. Keep the `ToolType` and `SnapResult` types — those are used.

This simplifies the store interface, reduces re-render subscriptions in
`CanvasContainer`, and removes misleading dead code.

---

## R4 · Extract shared form primitives from `PropertiesPanel` (Medium impact)

**File:** `src/components/PropertiesPanel.tsx` (728 lines)

**Problem.** Every sub-component (`WallProperties`, `FurnitureProperties`, etc.) repeats
the same three-part pattern:

```tsx
const [value, setValue] = useState(item.field);
useEffect(() => { if (item) setValue(item.field); }, [item.field]);
const commit = () => { if (v !== item.field) updateX(id, { field: v }); };
```

And the same `<input type="number">` + unit label structure appears 10+ times.

**Proposal.** Extract two shared primitives:

```ts
// src/hooks/useCommittedField.ts
function useCommittedField<T>(
  externalValue: T,
  onCommit: (v: T) => void
): [T, (v: T) => void, () => void]
// Returns [localValue, setLocalValue, commit]
// Syncs from externalValue via useEffect; calls onCommit only if changed
```

```tsx
// src/components/ui/NumberField.tsx
function NumberField({
  value, onChange, onCommit, min, max, step, unit, className
}: NumberFieldProps)
// Combines <input type="number"> + unit label + blur/Enter commit
```

This eliminates ~60% of the repetition in `PropertiesPanel` and makes the
"sync-then-commit" pattern explicit and reusable.

---

## R5 · Fix grid snap using `plan.gridSize` instead of `settings.defaultGridSize` (Medium impact / correctness) ✅ DONE

**File:** `src/geometry/snapping.ts` (line 112), `src/canvas/interaction/useMouseEvents.ts`

**Problem.** The snapping function reads `settings.defaultGridSize` for grid alignment:

```ts
x: snapToGrid(cursor.x, settings.defaultGridSize),
```

But each `Plan` has its own `plan.gridSize` field (editable in the Properties panel as
"Grid Size"). If the user sets a per-plan grid size of 50 cm, snapping still uses the
default from `UserSettings`. The canvas grid *renders* correctly (it uses `plan.gridSize`
in `drawGrid`), but snapping ignores it.

**Proposal.** Pass `gridSize: number` explicitly to `applySnapping`:

```ts
export function applySnapping(
  cursor, walls, settings, viewport, ppcm,
  chainStart = null, shiftHeld = false,
  gridSize?: number   // ← new; falls back to settings.defaultGridSize if omitted
): SnapResult
```

All call sites in `useMouseEvents` already have access to `plan.gridSize` and pass it.
This is a one-parameter change with a backward-compatible default.

---

## R6 · Extract `openingBBox` and `roomBBox` helpers from `hitTest.ts` (Low-medium impact)

**File:** `src/geometry/hitTest.ts` (lines 164–221)

**Problem.** `hitTestPlanInRect` computes bounding boxes for rooms and openings inline,
duplicating the same arithmetic already present in `wallBBox` and `furnitureBBox`:

```ts
// inline in hitTestPlanInRect — same trig as furnitureBBox
const cx = wall.start.x + ux * wallLen * opening.position;
...
const bbox = { minX: Math.min(...corners.map(c => c.x)), ... };
```

**Proposal.** Add two exported helpers alongside the existing `wallBBox` / `furnitureBBox`:

```ts
export function roomBBox(room: Room): BBox
export function openingBBox(opening: Opening, walls: Wall[]): BBox | null
```

Then `hitTestPlanInRect` becomes one `bboxesOverlap` call per element type.
Both helpers are also independently testable and can be reused for the export
bounds computation in `canvas/export.ts`.

---

## R7 · Unify hit-test threshold constant; remove the 12 vs 8 discrepancy (Low impact / correctness)

**Files:** `src/geometry/snapping.ts` (line 88), `src/canvas/interaction/useMouseEvents.ts` (line 165)

**Problem.** Two different magic numbers define the "12 screen pixels" hit threshold:

```ts
// snapping.ts
const threshold = 12 / (ppcm * viewport.zoom);

// useMouseEvents.ts
const getHitThreshold = () => 8 / (PPCM * getViewport().zoom);
```

Snap radius is 12 screen px; selection hit radius is 8 screen px. These may be
intentionally different, but both are undocumented magic numbers used in multiple
places.

**Proposal.** Declare named constants in `src/geometry/transforms.ts`:

```ts
export const SNAP_THRESHOLD_PX = 12;   // screen pixels for snapping
export const HIT_THRESHOLD_PX = 8;     // screen pixels for click selection
```

And compute them via:

```ts
export function snapThreshold(zoom: number, ppcm = PPCM): number {
  return SNAP_THRESHOLD_PX / (ppcm * zoom);
}
export function hitThreshold(zoom: number, ppcm = PPCM): number {
  return HIT_THRESHOLD_PX / (ppcm * zoom);
}
```

Both functions are pure, testable, and document the intent of the constants.

---

## R8 · Consolidate `findOpeningTarget` with `hitTestWallForOpening` (Low impact)

**Files:** `src/canvas/interaction/useMouseEvents.ts` (lines 169–190),
`src/geometry/hitTest.ts` (lines 19–29)

**Problem.** `findOpeningTarget` in `useMouseEvents` is a near-duplicate of
`hitTestWallForOpening`. Both project a cursor point onto a wall segment and return a
parametric `t` value. `findOpeningTarget` adds two things over `hitTestWallForOpening`:
(a) iterates all walls to find the best, and (b) clamps `t` to `[0.05, 0.95]`.

**Proposal.** Rename `hitTestWallForOpening` → `projectOntoWall` (returns `t | null`)
and add a `findBestWallForOpening(walls, point, threshold)` function in `hitTest.ts`
that iterates walls and returns `{ wallId, t } | null`. `findOpeningTarget` in
`useMouseEvents` reduces to one call.

---

## R9 · Reduce `useStore` call count in `CanvasContainer` (Low impact / performance)

**File:** `src/canvas/CanvasContainer.tsx`

**Problem.** `CanvasContainer` makes 17 separate `useStore(selector)` calls. Each
creates an independent subscription, so `CanvasContainer` re-renders once per changed
field. When the user pans the canvas, `plan.viewport` changes → re-render → new
`renderFn` → canvas re-draw. This is correct, but the 17 separate subscriptions make
the subscription surface area hard to audit.

**Proposal.** Group the render-state fields into a single combined selector:

```ts
const renderState = useStore(s => ({
  plan: s.activePlanId ? s.plans[s.activePlanId] : null,
  settings: s.settings,
  selectedIds: s.selectedIds,
  // ... etc
}), shallow);   // Zustand useShallow from 'zustand/shallow'
```

This reduces the number of subscriptions to ~3 (renderState, actions, UI-only state)
and makes the data dependencies of the render loop explicit.

Note: requires importing `useShallow` from `zustand/shallow` (already a transitive
dependency).

---

## Summary Table

| # | File(s) | Type | Impact |
|---|---------|------|--------|
| R1 ✅ | `useMouseEvents.ts` | Structural split | 🔴 High |
| R2 ✅ | `PlanListModal.tsx` + `store/index.ts` | Bug-risk fix | 🔴 High |
| R3 ✅ | `store/index.ts`, `types/tools.ts`, renderer | Dead code removal | 🟡 Medium |
| R4 | `PropertiesPanel.tsx` | DRY extraction | 🟡 Medium |
| R5 ✅ | `snapping.ts` | Correctness fix | 🟡 Medium |
| R6 | `hitTest.ts` | DRY extraction | 🟢 Low-medium |
| R7 | `transforms.ts`, `snapping.ts`, `useMouseEvents` | Named constants | 🟢 Low |
| R8 | `hitTest.ts`, `useMouseEvents` | Deduplication | 🟢 Low |
| R9 | `CanvasContainer.tsx` | Performance | 🟢 Low |

Items R1–R2 have the highest payoff per effort. R3 is risk-free and immediate.
R5 is a correctness fix that affects behaviour. The rest are quality-of-life.
