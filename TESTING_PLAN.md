# FloorPlanner — Testing Plan

## Stack

| Layer | Tool |
|-------|------|
| Unit / integration | Vitest (jsdom), co-located `.test.ts` files |
| E2E / visual | Playwright (browser automation) |

Run unit tests: `npx vitest run`
Watch mode: `npx vitest`
E2E: `npx playwright test`

---

## Priority 1 — Correctness-Critical (implement first)

These are pure functions with no UI dependencies. They underpin every interaction:
hit-testing, snapping, coordinate transforms. A bug here is invisible in dev but
causes wrong geometry silently.

### `src/geometry/point.test.ts`

| Test | Function | Expectation |
|------|----------|-------------|
| distance between (0,0) and (300,0) | `distance` | 300 |
| distance between (0,0) and (0,0) | `distance` | 0 |
| midpoint of (0,0)→(100,0) | `midpoint` | `{x:50,y:0}` |
| lerp t=0 returns start, t=1 returns end | `lerp` | exact |
| normalize (3,4) | `normalize` | `{x:0.6,y:0.8}` |
| dot product (1,0)·(0,1) | `dot` | 0 |
| perpendicular of (1,0) | `perpendicular` | `{x:0,y:1}` or `{x:0,y:-1}` |

### `src/geometry/segment.test.ts`

| Test | Function | Expectation |
|------|----------|-------------|
| length of (0,0)→(3,4) | `segmentLength` | 5 |
| angle of horizontal segment | `segmentAngle` | 0 |
| angle of vertical segment | `segmentAngle` | π/2 |
| nearest point on horiz. segment, point above midpoint | `nearestPointOnSegment` | midpoint |
| nearest point outside segment, beyond end | `nearestPointOnSegment` | clamped to end |
| point directly above midpoint of horiz. seg | `pointToSegmentDist` | perpendicular dist |
| point beyond end of segment | `pointToSegmentDist` | dist to endpoint |

### `src/geometry/transforms.test.ts`

| Test | Expectation |
|------|-------------|
| `worldToScreen(0, 0, {zoom:1, panX:0, panY:0}, 4)` | `{x:0, y:0}` |
| `worldToScreen(100, 0, {zoom:1, panX:0, panY:0}, 4)` | `{x:400, y:0}` |
| `worldToScreen` → `screenToWorld` round-trip at zoom=2, pan=50,30 | matches original ±0.001 |
| `applyZoom` increases zoom when scrolling up (deltaY < 0) | `newZoom > oldZoom` |
| `applyZoom` centering: zoom around cursor keeps cursor world position fixed | world position of cursor unchanged ±0.001 |

### `src/geometry/units.test.ts`

| Test | Expectation |
|------|-------------|
| `formatMeasurement(300, 'cm')` | `"300 cm"` |
| `formatMeasurement(300, 'm')` | `"3.00 m"` |
| `formatMeasurement(300, 'ft')` | `"9' 10\""` |
| `formatMeasurement(30.48, 'ft')` | `"1' 0\""` |
| `parseImperialInput("12' 6\"")` | ~381 cm |
| `parseImperialInput("6\"")` | ~15.24 cm |
| `parseImperialInput("5")` (bare number) | ~152.4 cm (5 feet) |

### `src/geometry/snapping.test.ts`

| Test | Function | Expectation |
|------|----------|-------------|
| 13 snaps to 10 with gridSize=10 | `snapToGrid` | 10 |
| 16 snaps to 20 with gridSize=10 | `snapToGrid` | 20 |
| point within threshold of endpoint snaps to it | `snapToEndpoints` | endpoint `{type:'endpoint'}` |
| point outside threshold does not snap | `snapToEndpoints` | `null` |
| `applySnapping` with no walls → grid snap | `applySnapping` | `type:'grid'` |
| `applySnapping` with endpoint in range → endpoint priority | `applySnapping` | `type:'endpoint'` |
| shift held + `applySnapping` → angle snap 0°/45°/90° | `applySnapping` | `type:'angle'` |
| threshold = 12 / (ppcm × zoom) correctly at zoom=2 | `applySnapping` | ~1.5 world cm |

### `src/geometry/hitTest.test.ts`

| Test | Function | Expectation |
|------|----------|-------------|
| point on centerline of wall → hit | `hitTestWall` | `true` |
| point > thickness/2 + threshold away → miss | `hitTestWall` | `false` |
| point at start endpoint (within threshold) | `hitTestWallEndpoint` | `'start'` |
| point far from both endpoints | `hitTestWallEndpoint` | `null` |
| point inside convex polygon | `hitTestRoom` | `true` |
| point outside polygon | `hitTestRoom` | `false` |
| point at center of unrotated furniture | `hitTestFurniture` | `true` |
| point outside rotated furniture (world frame) | `hitTestFurniture` | `false` |
| `hitTestPlan` returns topmost element id when overlapping | `hitTestPlan` | text > wall priority |
| rubber-band rect enclosing 2 walls, not a third | `hitTestPlanInRect` | 2 ids returned |
| `wallBBox` — axis-aligned bbox expands by thickness/2 | `wallBBox` | correct minX/maxX |

---

## Priority 2 — Store Correctness

These verify the undo/redo and CRUD logic. Use Zustand's `create` directly (no React).

### `src/store/history.test.ts`

```typescript
// Setup helper
import { create } from 'zustand';
// Re-create a minimal store OR import useStore and call .getState()
```

| Test | Expectation |
|------|-------------|
| Add 2 walls, `undo()`, plan has 1 wall | `walls.length === 1` |
| Add wall, undo, `redo()`, plan has 1 wall again | `walls.length === 1` |
| Undo with empty history is a no-op | no throw, state unchanged |
| `withHistory` caps past at 100 entries | `past.length <= 100` |
| New action after undo clears `future` | `future.length === 0` |
| `setCamera` does NOT create history entry | `past.length` unchanged |

### `src/store/crud.test.ts`

| Test | Expectation |
|------|-------------|
| `addWall` → wall in plan with generated id | `walls[0].id` truthy |
| `deleteWall(id)` removes wall and its openings | `walls` empty, `openings` empty |
| `moveElements([wallId], 10, 20)` translates both endpoints | `start.x += 10`, `start.y += 20` |
| `deleteElements([wallId])` also removes attached openings | `openings` empty |
| `updateWallEndpoints([{id, endpoint:'start', position}])` updates only that endpoint | `end` unchanged |
| `setActivePlanNoHistory` replaces plan without pushing to `past` | `past.length === 0` |

---

## Priority 3 — E2E (Playwright)

These validate the full interaction loop in a real browser. Run after each checkpoint.

### Setup

```bash
npx playwright install chromium
```

Create `e2e/` directory with test files.

### `e2e/wall-drawing.spec.ts`

| Test | Steps | Assertion |
|------|-------|-----------|
| Draw a wall | Press W, click at (200,300), click at (400,300) | Canvas shows a wall segment |
| Escape cancels chain | Press W, click, press Escape | No wall added |
| Double-click ends chain | Press W, click, double-click | Single wall added (double-click wall undone) |
| Ctrl+Z removes last wall | Draw 2 walls, Ctrl+Z | 1 wall visible |

### `e2e/selection.spec.ts`

| Test | Steps | Assertion |
|------|-------|-----------|
| Click wall selects it | Draw wall, press V, click wall | Blue handles visible |
| Click empty deselects | Select wall, click empty area | Handles gone |
| Delete removes selected | Select wall, press Delete | Wall gone |
| Drag wall moves it | Select wall, drag | Wall at new position |
| Rubber-band selects multiple | Draw 2 walls, drag rubber-band over both | Both highlighted |

### `e2e/persistence.spec.ts`

| Test | Steps | Assertion |
|------|-------|-----------|
| Plan survives page reload | Draw wall, reload page | Wall still present |

---

## Test Coverage Targets

| Module | Target | Notes |
|--------|--------|-------|
| `geometry/` | 100% line coverage | Pure functions, easy to cover |
| `store/` | 80% | History, CRUD, selection actions |
| Canvas layers | 0% (skip unit tests) | Rendering is better tested visually / E2E |
| React components | 0% (skip unit tests) | Thin wrappers over store; E2E covers behaviour |

---

## Running Order

```bash
# 1. Unit tests (fast, ~1s)
npx vitest run

# 2. Build check (catches type errors missed by tests)
npx tsc --noEmit && npx vite build

# 3. E2E (slower, requires dev server)
npx vite preview &
npx playwright test
```

The PostToolUse hooks in `.claude/settings.json` already run `tsc --noEmit` and
`vitest run` automatically after every file edit.
