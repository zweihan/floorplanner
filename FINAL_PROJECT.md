# FloorPlanner — Project Specification

## 1. Project Overview

### 1.1 Summary

FloorPlanner is a browser-based web application that enables users to design dimensionally accurate 2D floor plans. Users can draw walls, place doors and windows, create rooms, furnish spaces, add measurement annotations, and export their plans — all with real-world measurements. The app targets homeowners, interior designers, real estate agents, and hobbyists who need quick, accurate floor plans without professional CAD software.

### 1.2 Core Value Proposition

- **Size-accurate**: Every element maps to real-world dimensions (metric and imperial)
- **Easy to use**: Intuitive drawing tools — no CAD experience required
- **Browser-based**: No installation, works on desktop browsers
- **Export-ready**: Generate shareable PNGs, PDFs, or JSON project files

### 1.3 Goals

- Enable non-technical users to create accurate floor plans without CAD software
- Ensure all drawn elements correspond to real-world measurements (metric and imperial)
- Provide a snapping and alignment system that makes drawing precise and efficient
- Allow users to save, load, and export their plans
- Run entirely in the browser with no required backend (optional cloud save)

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | Component model suits complex UI state; strong typing critical for geometry code |
| Build Tool | Vite | Fast HMR, simple config |
| Canvas Rendering | HTML5 Canvas 2D API (via custom hook) | Full control over rendering pipeline; no library overhead |
| State Management | Zustand | Minimal boilerplate; supports undo/redo middleware cleanly |
| Styling | Tailwind CSS | Rapid UI development; utility classes avoid CSS file sprawl |
| Persistence | localStorage (primary) + JSON export | Zero-backend MVP; exportable for portability |
| Testing | Vitest + React Testing Library | Co-located with Vite; good coverage of geometry utilities |
| PDF Export | jsPDF (stretch goal) | Client-side PDF generation |

Do **not** use a high-level canvas library (Fabric.js, Konva, etc.) — the geometry and rendering logic is core product logic and must be owned directly.

---

## 3. Core Concepts

### 3.1 Coordinate System

- **World coordinates**: Real-world units. The internal coordinate system uses **centimeters** as the base storage unit.
- **Screen coordinates**: Pixel positions on the canvas element.
- The origin `(0, 0)` is the top-left of the floor plan world space.
- The canvas renders at a configurable **pixels-per-centimeter (ppcm)** scale.
- Screen coordinates are derived by: `screenX = worldX * ppcm * zoom + panOffsetX` (and inverse for `screenToWorld`).
- All stored data (saved plans) uses centimeter values exclusively. Display conversion happens at the view layer.

### 3.2 Scale

- Default display scale: **1 cm = 4 px** (approximately 1:25 at 96 DPI).
- User can zoom in/out; zoom affects only the display multiplier, never stored world coordinates.
- A **scale ruler** overlay renders on-canvas showing the current real-world scale.

### 3.3 Snapping

Four types of snapping (each independently togglable):

1. **Grid snap** — snaps to configurable grid increments (default: 10 cm / ~4 inches)
2. **Wall endpoint snap** — snaps to existing wall endpoints within a screen-space threshold of **12 px** (converted to world units at current zoom: `threshold_world = 12 / (ppcm * zoom)`)
3. **Wall midpoint snap** — snaps to the midpoint of an existing wall segment (same 12 px screen-space threshold)
4. **Angle snap** — when drawing a wall, snap to 0°, 45°, 90° angles relative to the previous segment. Also activates when Shift is held (constrains to 0°/90°/180°/270°)

**Snapping priority** (highest to lowest): endpoint > midpoint > angle > grid.

**Visual indicator**: Draw a small circle (radius 5 px) or crosshair at the active snap target point.

### 3.4 Layers

Elements are organized into three layers:

| Layer | Contents | Default State |
|---|---|---|
| `structure` | Walls, Doors, Windows, Rooms | visible, unlocked |
| `furniture` | Furniture items | visible, unlocked |
| `annotations` | Dimension lines, Text labels | visible, unlocked |

Each layer has independent `visible` and `locked` toggles. Locked layers prevent selection and editing of their elements. Hidden layers are not rendered.

---

## 4. Data Model

All plan data is serialized to/from JSON. Internal storage always uses centimeters.

### 4.0 Primitive Types

```typescript
// All geometry is in centimeters unless noted otherwise
interface Point { x: number; y: number; }

type DisplayUnit = "cm" | "m" | "ft";  // "ft" means feet-and-inches (e.g. "12' 6\"")
```

### 4.1 Top-Level Plan

```typescript
interface Plan {
  id: string;                  // UUID
  name: string;
  createdAt: string;           // ISO 8601
  updatedAt: string;
  unit: "cm" | "m" | "ft" | "in";   // display unit (storage always in cm)
  gridSize: number;            // grid increment in cm
  width: number;               // document width in cm
  height: number;              // document height in cm
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];         // doors and windows
  furniture: FurnitureItem[];
  dimensions: DimensionLine[];
  textLabels: TextLabel[];
  viewport: Viewport;
}
```

### 4.2 Wall

```typescript
interface Wall {
  id: string;
  start: Point;                // { x: number, y: number } in cm
  end: Point;
  thickness: number;           // wall thickness in cm (default: 15 cm / ~6")
  height: number;              // wall height in cm (metadata, not rendered; default: 244 cm / 8')
  color: string;               // default "#2d2d2d"
  layer: "exterior" | "interior";  // NOTE: this is the wall TYPE (not the canvas layer system)
}
```

> **Naming note**: `Wall.layer` (`"exterior" | "interior"`) describes the *architectural type* of the wall. It is separate from the canvas layer system (`LayerName`: `"structure" | "furniture" | "annotations"`). All walls belong to the `"structure"` canvas layer. `Wall.layer` is only used in the Properties Panel display — it does not affect rendering or layer visibility logic.

- Walls are line segments with thickness.
- Rendering: Draw as a rectangle rotated along the wall's angle, centered on the line segment.
- Hit testing: Point-to-thick-line-segment distance < `thickness/2 + threshold`.
- Walls auto-join at endpoints within a snap threshold. When two wall endpoints are within threshold, they merge to the same coordinate.

### 4.3 Room

```typescript
interface Room {
  id: string;
  name: string;                // e.g. "Kitchen", "Bedroom 1"
  wallIds: string[];           // ordered list of wall IDs forming the boundary
  points: Point[];             // ordered polygon vertices (derived from walls or drawn directly)
  color: string;               // fill color (hex, with alpha)
  area: number;                // computed in cm², displayed in user's chosen unit
  labelPosition: Point;        // where the room label is rendered (default: centroid)
  showArea: boolean;           // display calculated area (default: true)
  showLabel: boolean;          // display room name (default: true)
}
```

- Rooms are closed polygons filled with a label and optional area display.
- Area is computed via the shoelace formula and displayed at the label position.
- Rooms render behind walls in the render order.
- **`wallIds` vs `points`**: `points` is the authoritative polygon for rendering and area calculation. `wallIds` is an optional annotation for rooms created by wall-chain closing (F2.6). When a wall in `wallIds` is moved, the corresponding `points` entry must be updated: call `updateRoom(id, { points: wallsToPolygon(wallIds.map(id => findWall(id))) })`. For directly-drawn rooms (F3.2), `wallIds` is empty and `points` is managed directly.
- **`area`** is not stored persistently — it is recomputed at render time from `points` using `polygonArea(room.points)`. Do not store stale area values.

### 4.4 Opening (Doors & Windows)

```typescript
interface Opening {
  id: string;
  wallId: string;              // parent wall
  type: "door" | "window" | "sliding-door" | "double-door" | "bay-window";
  position: number;            // 0.0–1.0, parametric position along parent wall
  width: number;               // in cm (door default: 90 cm, window default: 120 cm)
  height: number;              // in cm (relevant for windows; default: 120 cm)
  sillHeight: number;          // in cm from floor (windows only; default: 90 cm)
  swingDirection: "left" | "right" | "inward" | "outward";  // doors only
  openAngle: number;           // swing arc angle in degrees (default: 90)
  flipSide: boolean;           // which side of wall the arc draws on
}
```

- Doors create a gap in the wall rendering. The swing arc is drawn as a quarter-circle (or configured angle).
- Windows create a gap with a standard window symbol (parallel lines).
- Sliding doors render as two overlapping rectangles. Double doors render as two opposing arcs.

### 4.5 Furniture

```typescript
interface FurnitureItem {
  id: string;
  templateId: string;          // references built-in furniture library
  label: string;
  position: Point;             // center position in world space, in cm
  width: number;               // in cm
  depth: number;               // in cm
  rotation: number;            // degrees, clockwise
  color: string;               // default "#a0a0a0"
  locked: boolean;
}
```

### 4.5b FurnitureTemplate (Library Entry)

Not stored in the plan file — lives in `data/furnitureLibrary.ts`.

```typescript
type FurnitureSymbol =
  | "backrest-line"      // horizontal line at 30% depth
  | "headboard"          // line + pillow rects
  | "chair-arc"          // arc at top 25%
  | "toilet-shape"       // oval tank + bowl
  | "bathtub-shape"      // inset rect + oval
  | "sink-circle"        // circle inside square
  | "stove-burners"      // 4 small circles
  | "none";              // plain rectangle

interface FurnitureTemplate {
  id: string;             // e.g. "sofa-2-seater"
  category: "living" | "bedroom" | "kitchen-dining" | "bathroom" | "office";
  label: string;          // display name
  defaultWidth: number;   // in cm
  defaultDepth: number;   // in cm
  symbol: FurnitureSymbol;
  defaultColor: string;   // hex; default "#8a8a8a"
}
```

### 4.6 Dimension Line

```typescript
interface DimensionLine {
  id: string;
  start: Point;                // in cm
  end: Point;                  // in cm
  offset: number;              // perpendicular offset from the measured line, in cm
  overrideText: string | null; // if set, display this instead of calculated length
  // Optional: attach endpoints to wall endpoints for auto-update on wall move
  startWallId?: string;        // wallId whose start/end point this attaches to
  startWallEnd?: "start" | "end";
  endWallId?: string;
  endWallEnd?: "start" | "end";
}
```

- Auto-calculates and displays the distance between two points.
- When `startWallId`/`endWallId` are set, the dimension's `start`/`end` Points are recomputed from the referenced wall endpoint on every render, so they track wall movement automatically.
- Renders as a line with perpendicular end caps and centered text.
- Text shows value in current document units with appropriate precision (e.g., `12' 0"` or `3.66 m`).

### 4.7 Text Label

```typescript
interface TextLabel {
  id: string;
  position: Point;             // in cm
  text: string;
  fontSize: number;            // in world units (cm), so it scales with zoom
  color: string;               // default "#333333"
  align: "left" | "center" | "right";
}
```

### 4.8 Viewport

```typescript
interface Viewport {
  panX: number;                // canvas pan offset in pixels
  panY: number;
  zoom: number;                // ppcm multiplier (1.0 = default 4px/cm)
}
```

Viewport state is saved with the plan for UX continuity but is not part of plan geometry.

### 4.9 DrawingState

Transient state held while a drawing operation is in progress. Stored in the Zustand store but **not** persisted to localStorage or undo history.

```typescript
interface DrawingState {
  tool: ToolType;                  // which tool is active
  phase: "idle" | "drawing" | "placing" | "dragging";
  // For wall drawing:
  chainStart: Point | null;        // first point in the current wall chain
  // For opening placement (door/window):
  pendingOpeningType: Opening["type"] | null;
  pendingOpeningWallId: string | null;
  // For rubber-band selection:
  rubberBandStart: Point | null;
  // For dragging existing elements:
  dragStartWorld: Point | null;
  dragStartPositions: Record<string, Point>; // id → original position before drag
}
```

### 4.10 UserSettings

Global preferences persisted in `localStorage` independently from plan data.

```typescript
interface UserSettings {
  displayUnit: "cm" | "m" | "ft";  // ft means feet-and-inches
  defaultWallThickness: number;     // in cm; default 15
  defaultGridSize: number;          // in cm; default 10
  snapToGrid: boolean;              // default true
  snapToEndpoint: boolean;          // default true
  snapToMidpoint: boolean;          // default false
  snapToAngle: boolean;             // default true
  showDimensions: boolean;          // default true
  theme: "light" | "dark";         // default "light"
}
```

### 4.11 SnapResult

Returned by the snapping functions to indicate which snap type was applied.

```typescript
interface SnapResult {
  point: Point;                     // snapped world position
  type: "endpoint" | "midpoint" | "angle" | "grid" | "none";
  targetId?: string;                // wallId that was snapped to (for endpoint/midpoint)
}
```

---

## 5. Feature Requirements

### F1 — Canvas & Viewport

**F1.1** The main canvas fills the available window area, minus toolbars and panels.

**F1.2** Pan the canvas by clicking and dragging with the middle mouse button, or by holding `Space` and left-drag.

**F1.3** Zoom with the scroll wheel (mouse or trackpad pinch). Min zoom: 0.1×, max: 8×. Zoom is centered on the cursor position, not the canvas corner.

**F1.4** A grid is rendered on the canvas. Minor grid lines at `gridSize` intervals (light dots/lines). Major grid lines every `gridSize × 5` intervals (slightly bolder). Grid scales with zoom — when zoomed out far, skip minor lines to avoid clutter. Grid renders at reduced opacity.

**F1.5** A scale bar renders in the bottom-left corner of the canvas overlay. It shows a fixed screen-length bar labeled with the corresponding real-world length.

**F1.6** Cursor coordinates in world-space (using the user's chosen display unit) are shown in a HUD in the bottom-right corner of the canvas.

**F1.7** Canvas re-renders on every state change via `requestAnimationFrame` (not a continuous loop). Target 60 fps during interactions.

---

### F2 — Wall Drawing Tool

**F2.1** Activate the wall tool via toolbar button or keyboard shortcut `W`.

**F2.2** Click to place the start of a wall. Move the cursor; a preview line (ghost wall) follows the cursor respecting active snapping rules. Click again to commit the wall segment.

**F2.3** The tool enters a chained drawing mode: after committing a wall, the next wall's start is automatically set to the last wall's end. Double-click or press `Escape` to end the chain. Right-click also ends the chain.

**F2.4** While in the chain, pressing `Escape` removes only the uncommitted preview segment, not already-committed walls.

**F2.5** A tooltip near the ghost wall shows the current segment's length (in the user's display unit) and angle in degrees.

**F2.6** Closing a loop: when the preview endpoint snaps to the chain's first point, the cursor highlights it in green. A single click closes the polygon and auto-creates a `Room` from the enclosed area.

**F2.7** Wall thickness is configurable per-wall via the properties panel; default is 15 cm (~6"). The wall is rendered as a filled rectangle centered on the line segment.

**F2.8** Walls are drawn on top of the grid, with fill color `#2d2d2d` (dark charcoal) and proper thickness rendering.

**F2.9** Holding `Shift` while drawing constrains the wall angle to 0°/90°/180°/270° (orthogonal constraint).

---

### F3 — Room Tool

**F3.1** Activate the room tool via toolbar button or keyboard shortcut `R`.

**F3.2** Click to place polygon vertices. Show preview polygon with dashed outline while drawing.

**F3.3** Double-click or click near start point to close the polygon.

**F3.4** After closing, prompt for room label (or use default "Room N").

**F3.5** A room is also auto-created when a wall chain forms a closed polygon (see F2.6).

**F3.6** A room can also be manually created by selecting 3+ walls that form a closed loop and clicking "Create Room" in the context menu.

**F3.7** Each room renders with a semi-transparent fill color (default palette: a set of 8 muted architectural pastels, cycling per new room).

**F3.8** A room label (name + area) renders at the room's visual centroid. The user can drag the label to reposition it independently.

**F3.9** Area is computed using the shoelace formula on the room's boundary polygon (in cm²), then converted to the user's display unit (m², ft², etc.).

**F3.10** Rooms are listed in a **Rooms Panel** (left sidebar). Clicking a room in the list selects and pans/zooms the canvas to show it.

---

### F4 — Selection & Editing

**F4.1** Activate the select tool via toolbar button or keyboard shortcut `V` (or `Escape` from any other tool).

**F4.2** Click on a wall, opening, room, furniture, or annotation to select it. Selected items render with a blue highlight and visible handles.

**F4.3** Click on empty space to deselect all.

**F4.4** Drag an endpoint handle of a wall to reposition that endpoint. Connected walls (sharing that endpoint) update automatically — maintain a lookup: `endpointCoord → [wallId, ...]` for joined walls.

**F4.5** Drag a wall's midpoint handle to move the entire wall segment (both endpoints translate equally).

**F4.6** Multiple selection: hold `Shift` to add/remove items from selection. Drag a rubber-band rectangle on empty space to select all items within the region.

**F4.7** Shows resize handles on selected furniture (corner drag to resize; hold Shift to preserve aspect ratio).

**F4.8** Shows rotation handle on selected furniture (8 px radius circle rendered 24 px above the bounding box top-center in screen space). Dragging the rotation handle rotates the furniture around its center point. Snap to 15° increments when Shift is held. A thin line connects the bounding box top-center to the rotation handle.

**F4.9** Double-click text labels or room labels to enter inline edit mode.

**F4.10** When one or more items are selected, a **Properties Panel** on the right side shows editable fields:
  - For walls: start point, end point, length (editable; adjusts end point), thickness, color, layer (exterior/interior)
  - For rooms: name, fill color, computed area (read-only), show area toggle, show label toggle
  - For openings: type, width, height, position on wall (as distance from start), swing direction, open angle, flip side
  - For furniture: label, position (x, y), width, depth, rotation, color
  - For dimensions: override text
  - For text labels: text content, font size, color, alignment
  - When nothing is selected: document settings (name, units, grid size, document size)

**F4.11** Editing a value in the Properties Panel immediately updates the canvas (no "apply" button needed).

**F4.11b Color Picker**: For wall color, room fill color, furniture color, and text color fields in the Properties Panel, use an `<input type="color">` HTML element styled to match the panel. Wrap it in a small swatch: `<div style={{ background: value }}><input type="color" value={value} onChange={e => update(e.target.value)} /></div>`. No external color picker library needed.

**F4.12** Delete selected items with the `Delete` or `Backspace` key. Deleting a wall that is part of a room boundary removes the room. Deleting a wall also deletes attached doors/windows (with a brief toast notification).

**F4.13** Drag selected items to move them. Items snap to grid when moved.

**F4.14** `Ctrl+A` / `Cmd+A` selects all unlocked, visible elements.

---

### F5 — Openings (Doors & Windows)

**F5.1** Activate the door tool with `D` or the window tool with `N`. Alternatively, use the combined opening tool with `O` which provides a sub-selector for type.

**F5.2** Click on an existing wall to place the opening. The opening snaps to the click position along the wall.

**F5.3** After placing, defaults are: door = 90 cm width, window = 120 cm width.

**F5.4** Doors are rendered as an arc indicating the swing direction, plus a line for the door leaf. The arc is a quarter-circle by default. The door creates a gap in the wall rendering.

**F5.5** Windows are rendered as a gap in the wall with double parallel lines (standard architectural symbol).

**F5.6** Sliding doors render as two overlapping rectangles. Double doors render as two opposing arcs.

**F5.7** The opening must fit within the parent wall's length (validation: `openingWidth ≤ wallLength − 10 cm`).

**F5.8** If the parent wall is deleted, all openings on that wall are also deleted (toast notification to user).

**F5.9** If a parent wall is resized such that the opening no longer fits, clamp its position to remain within bounds.

---

### F6 — Furniture Library

**F6.1** A **Furniture Panel** (collapsible left sidebar, ~200px wide) lists built-in furniture templates organized by category in accordion sections.

**F6.2** Built-in categories and items with default dimensions (width × depth in cm):

| Category | Items |
|---|---|
| **Living** | Sofa 2-seater (183×91), Sofa 3-seater (229×91), Armchair (91×91), Coffee Table (122×61), TV Stand (152×46), Bookshelf (122×30) |
| **Bedroom** | Single Bed (91×198), Double Bed (137×198), Queen Bed (152×203), King Bed (193×203), Nightstand (61×61), Dresser (152×46), Wardrobe (122×61) |
| **Kitchen/Dining** | Dining Table 4-person (122×91), Dining Table 6-person (183×91), Chair (46×46), Refrigerator (91×76), Stove/Oven (76×61), Sink (61×61), Dishwasher (61×61) |
| **Bathroom** | Bathtub (152×76), Shower Square (91×91), Toilet (46×70), Sink Pedestal (46×46), Sink Vanity (122×61) |
| **Office** | Desk (152×76), Office Chair (61×61), Filing Cabinet (46×61) |

**F6.3** Each furniture template defines: default width, default depth, simple geometric shape data for rendering, and label. Each item shows name and dimensions in the palette.

**F6.4** Click a preset in the palette: this calls `setPendingFurnitureTemplateId(templateId)` and `setActiveTool("furniture")`. The cursor changes to a copy icon. A ghost furniture outline follows the cursor on canvas (using `ghostPoint` for position, snapped to grid). Click on the canvas to commit placement via `addFurniture(...)` and clear `pendingFurnitureTemplateId`. Press Escape to cancel placement.

**F6.5** After placement, furniture can be selected and resized (width/depth independently, or with Shift for proportional), rotated in 15° increments (or free rotation), via the properties panel or by dragging handles.

**F6.6** Furniture renders above the room fill but below wall strokes. Color default: medium gray `#8a8a8a` with labels.

**F6.7** `Alt + drag` duplicates the selected furniture item.

---

### F7 — Measurement & Dimension Annotations

**F7.1** Activate the dimension tool via toolbar or keyboard shortcut `M`. Click to set start point, click again to set end point.

**F7.2** A dimension line renders as a line with perpendicular end caps and the distance labeled at its midpoint. Rendering algorithm (`canvas/layers/dimensions.ts`):

```
For each DimensionLine d:
  // Resolve endpoints (may be attached to wall)
  start = d.startWallId ? getWallEndpoint(d.startWallId, d.startWallEnd) : d.start
  end   = d.endWallId   ? getWallEndpoint(d.endWallId,   d.endWallEnd)   : d.end

  // Convert to screen coords
  s = worldToScreen(start, viewport, ppcm)
  e = worldToScreen(end, viewport, ppcm)

  // Compute perpendicular direction for offset
  dir = normalize(e - s)
  perp = perpendicular(dir)   // rotated 90° left
  offsetPx = d.offset * ppcm * zoom  // offset in screen pixels

  // Draw offset lines from endpoints to the dimension line
  ctx.strokeStyle = "#1a3a5c"
  ctx.lineWidth = 1
  draw line from s to (s + perp * offsetPx + perp * 4)   // extension lines
  draw line from e to (e + perp * offsetPx + perp * 4)

  // Draw main dimension bar
  startBar = s + perp * offsetPx
  endBar   = e + perp * offsetPx
  draw line from startBar to endBar

  // Draw end caps (T-bars, not arrows): 8px perpendicular to the bar at each end
  draw line (startBar - dir*4) to (startBar + dir*4)
  draw line (endBar   - dir*4) to (endBar   + dir*4)

  // Draw label at midpoint of bar
  mid = (startBar + endBar) / 2
  text = d.overrideText ?? formatMeasurement(distance(start, end), settings.displayUnit)
  // Draw white backing rect, then text in "#1a3a5c", 10px monospace
  ctx.font = "10px monospace"
  ctx.fillStyle = "#1a3a5c"
  ctx.textAlign = "center"
  ctx.fillText(text, mid.x, mid.y - 4)
```

**F7.3** Dimension lines auto-update if the referenced endpoints are moved (when snapped to wall endpoints).

**F7.4** Walls auto-display their length when `showDimensions` is true. The label is centered along the wall, offset **12 cm perpendicular** to the wall (to the left side of the wall direction). Font size: `ctx.font = "11px system-ui"`, clamped so that at very low zoom the labels are skipped when the wall is less than 40px long on screen. Label renders in the `dimensions.ts` layer using a white backing rectangle for readability.

**F7.5** Toggle the display of all dimension annotations via toolbar icon or `showDimensions` setting.

**F7.6** Dimension text format: Imperial: `12' 6"`, Metric: `3.81 m`. Uses monospace-like rendering for numeric alignment.

---

### F8 — Text Tool

**F8.1** Activate the text tool via toolbar or keyboard shortcut `T`.

**F8.2** Click on canvas to place a text label. Immediately enters edit mode for typing.

**F8.3** Text labels can be repositioned, resized (font size), and recolored via the Properties Panel or by double-clicking to edit.

**F8.4** Inline text editing implementation: use a DOM `<textarea>` absolutely positioned over the canvas at the label's screen position. On Enter (or blur), commit the new text to the store and remove the textarea. On Escape, discard changes. Font, size, and color must match the canvas rendering as closely as possible.

---

### F9 — Eraser Tool

**F9.1** Activate the eraser tool via toolbar or keyboard shortcut `E`.

**F9.2** Click on any element to delete it.

**F9.3** When deleting structural elements (walls), confirm if the wall has attached doors/windows (brief inline confirmation or toast).

---

### F10 — Undo / Redo

**F10.1** Every state-mutating action (drawing, editing, deleting, moving) is recorded in an undo stack.

**F10.2** Undo: `Cmd+Z` (Mac) / `Ctrl+Z` (Win/Linux). Redo: `Cmd+Shift+Z` / `Ctrl+Y`.

**F10.3** Undo stack is capped at 100 entries. Oldest entries are dropped. Viewport changes (pan/zoom) are not recorded.

**F10.4** After undo, any new action clears the redo stack (standard linear undo behavior).

---

### F11 — Save, Load & Export

**F11.1** **Auto-save**: The plan is saved to `localStorage` every 30 seconds and on every mutation with debounce (500 ms). A status indicator in the header shows "Saved" / "Saving…".

**F11.2** **Multiple plans**: Users can create, name, and switch between multiple plans. Plans are stored as a list in `localStorage` keyed by plan ID.

**F11.3** **JSON Export**: "Export as JSON" downloads the current plan as a `.floorplan.json` file. The schema is the `Plan` interface defined above. Implementation: `JSON.stringify(plan, null, 2)` → `Blob` → download link.

**F11.4** **JSON Import**: "Import JSON" opens a file picker (`<input type="file" accept=".json,.floorplan.json">`). Validate the schema before loading: check that `plan.walls`, `plan.rooms`, `plan.openings`, `plan.furniture`, `plan.dimensions`, `plan.textLabels` are all arrays, and `plan.id`, `plan.name` are strings. If validation fails, show an error toast. Assign a new `id = uuid()` to avoid collisions. Add to `plans` and set as `activePlanId`.

**F11.5** **PNG Export**: "Export as PNG" renders the canvas (without UI chrome) at configurable resolution (1×, 2×, 4×) and downloads it. White background, all visible layers rendered. Include a title block in the bottom-right corner: document name, scale, date, unit. User can configure whether the grid is included.

PNG Export implementation (`utils/export/exportPng.ts`):
```typescript
async function exportPng(plan: Plan, settings: UserSettings, options: {
  scale: 1 | 2 | 4;
  includeGrid: boolean;
}): Promise<void> {
  const ppcm = 4;  // base pixels per cm
  const zoom = 1.0;  // export at 1:1 world scale (all elements visible)
  const padding = 40;  // px
  // 1. Compute bounding box of all plan elements (walls, rooms, furniture)
  const bbox = computePlanBBox(plan);  // { minX, minY, maxX, maxY } in cm
  const worldW = bbox.maxX - bbox.minX + padding * 2 / ppcm;
  const worldH = bbox.maxY - bbox.minY + padding * 2 / ppcm;
  const canvasW = Math.round(worldW * ppcm * options.scale);
  const canvasH = Math.round(worldH * ppcm * options.scale) + 60 * options.scale; // extra for title block
  // 2. Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(options.scale, options.scale);
  // 3. White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW / options.scale, canvasH / options.scale);
  // 4. Set viewport to show all elements
  const viewport: Viewport = {
    panX: padding - bbox.minX * ppcm,
    panY: padding - bbox.minY * ppcm,
    zoom: 1.0,
  };
  // 5. Render all layers (skip selection UI and snap indicators)
  if (options.includeGrid) drawGrid(ctx, canvasW, canvasH, viewport, plan.gridSize, ppcm);
  drawRooms(ctx, plan, viewport, ppcm);
  drawFurniture(ctx, plan, viewport, ppcm);
  drawWalls(ctx, plan, viewport, ppcm);
  drawOpenings(ctx, plan, viewport, ppcm);
  drawDimensions(ctx, plan, viewport, ppcm, settings);
  drawTextLabels(ctx, plan, viewport, ppcm);
  drawRoomLabels(ctx, plan, viewport, ppcm, settings);
  // 6. Title block (bottom-right corner)
  const tbX = canvasW / options.scale - 240;
  const tbY = canvasH / options.scale - 55;
  ctx.fillStyle = "#f8f8f8";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.fillRect(tbX, tbY, 230, 50);
  ctx.strokeRect(tbX, tbY, 230, 50);
  ctx.fillStyle = "#111";
  ctx.font = "bold 12px system-ui";
  ctx.fillText(plan.name, tbX + 8, tbY + 18);
  ctx.font = "10px system-ui";
  ctx.fillText(`Scale: 1:${Math.round(1 / (ppcm / 100))} | Unit: ${settings.displayUnit} | ${new Date().toLocaleDateString()}`, tbX + 8, tbY + 36);
  // 7. Download
  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob!);
    a.download = `${plan.name.replace(/\s+/g, "_")}.png`;
    a.click();
  }, "image/png");
}
```

**F11.6** **PDF Export** (stretch goal): Use jsPDF or the browser's `window.print()` with a print-specific CSS layout that renders the canvas at the correct scale for A4 or Letter paper.

**F11.7** The "New Plan" action prompts for a name and creates an empty plan with default settings.

---

### F12 — Settings & Preferences

**F12.1** A Settings modal (`SettingsModal.tsx`) opens from the header gear icon. Layout:

```
┌────────────────────── Settings ──────────────────────┐
│                                                        │
│  Display Unit   ○ cm  ○ m  ● ft                       │
│                                                        │
│  Grid Size      [  10  ] cm                           │
│                                                        │
│  Wall Thickness [ 15   ] cm  (default for new walls)  │
│                                                        │
│  Snapping:                                             │
│    [x] Snap to grid                                    │
│    [x] Snap to endpoints                               │
│    [ ] Snap to midpoints                               │
│    [x] Snap to angles (0°/45°/90°)                    │
│                                                        │
│  Theme:         ● Light  ○ Dark                       │
│                                                        │
│                              [ Close ]                 │
└────────────────────────────────────────────────────────┘
```

Changes take effect immediately (call `updateSettings` on every input change). No "Apply" button needed. "Close" dismisses the modal (or click outside / Escape).

**F12.1b** `NewPlanModal.tsx` layout:

```
┌──────────── New Plan ────────────┐
│                                   │
│  Plan name:  [ Untitled Plan    ] │
│                                   │
│         [ Cancel ]  [ Create ]    │
└───────────────────────────────────┘
```

Enter key in the input field triggers Create. Escape key cancels. On Create: call `newPlan(name.trim() || "Untitled Plan")`.

**F12.2** Settings are persisted in `localStorage` and apply globally across all plans.

**F12.3** Unit switcher converts all displayed values. Imperial mode allows input as `12.5` (feet decimal) or `12' 6"` (feet-inches string). Both formats are parsed and stored as decimal cm internally.

---

## 6. UI Layout

### 6.1 Overall Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: App name | Plan name (editable) | Undo/Redo | Save     │
│  status | Settings | Export                                      │
├──────────┬──────────────────────────────────────────┬────────────┤
│          │                                          │            │
│  LEFT    │              CANVAS                      │ PROPERTIES │
│  SIDEBAR │    (floor plan drawing area)             │  PANEL     │
│          │                                          │  (right,   │
│ ┌──────┐ │  ┌─ grid overlay ──────────────────┐    │  ~250px)   │
│ │TOOLS │ │  │                                 │    │            │
│ │[Sel] │ │  │  floor plan content             │    │ (context-  │
│ │[Wall]│ │  │                                 │    │  sensitive)│
│ │[Room]│ │  └─────────────────────────────────┘    │            │
│ │[Door]│ │                                          │            │
│ │[Win] │ │  scale bar [BL]              coords [BR] │            │
│ │[Furn]│ │                                          │            │
│ │[Dim] │ │                                          │            │
│ │[Text]│ │                                          │            │
│ │[Eras]│ │                                          │            │
│ └──────┘ │                                          │            │
│ ┌──────┐ │                                          │            │
│ │ROOMS │ │                                          │            │
│ │panel │ │                                          │            │
│ └──────┘ │                                          │            │
│ ┌──────┐ │                                          │            │
│ │FURN. │ │                                          │            │
│ │panel │ │                                          │            │
│ └──────┘ │                                          │            │
│ ┌──────┐ │                                          │            │
│ │LAYERS│ │                                          │            │
│ │panel │ │                                          │            │
│ └──────┘ │                                          │            │
├──────────┴──────────────────────────────────────────┴────────────┤
│  STATUS BAR: Cursor coords | Scale | Snap indicators | Zoom %   │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Layout Details

- **Header**: Minimal, 48 px tall. Contains app name, editable plan name, undo/redo buttons, save status indicator, settings button, export dropdown menu.
- **Left sidebar**: Vertical tool strip (icon buttons with tooltips). Active tool is visually highlighted. Below the tools, collapsible accordion panels: Rooms Panel, Furniture Palette, Layer Panel.
- **Canvas**: Fills remaining space. HUD overlay (DOM, not canvas) for scale bar, coordinate display, zoom controls.
- **Properties Panel** (right, ~250px): Always visible when an item is selected; shows document settings when nothing is selected. Collapsed when empty.
- **Status bar**: Left: cursor world coordinates. Center: current scale. Right: zoom percentage and snap mode indicators.
- All panels are collapsible. The Furniture Palette is ~200px wide when open.

### 6.3 Layer Panel

- Lists all three layers (structure, furniture, annotations).
- Each layer has an eye icon (toggle visibility) and a lock icon (toggle locked).
- Locked layers prevent selection and editing of contained elements.

### 6.4 Toolbar Icon Reference (lucide-react)

| Tool | Icon Name | Key |
|---|---|---|
| Select | `MousePointer2` | V |
| Wall | `Pencil` | W |
| Room | `Pentagon` | R |
| Door | `DoorOpen` | D |
| Window | `AppWindow` | N |
| Furniture | `Sofa` | F |
| Dimension | `Ruler` | M |
| Text | `Type` | T |
| Eraser | `Eraser` | E |
| Pan | `Hand` | (Space) |

Header icons: `Undo2`, `Redo2` (undo/redo), `Save`, `Settings`, `Download` (export), `ChevronDown` (dropdown arrow).

Panel icons: `Eye` / `EyeOff` (layer visibility), `Lock` / `Unlock` (layer lock), `Layers` (layer panel header), `Armchair` (furniture panel header), `LayoutList` (rooms panel header).

All icons: size `16px` in toolbar, `14px` in panels. Import from `lucide-react`.

### 6.5 Header Plan Name Editor

The plan name in the header is an inline-editable text field:
- Default render: `<h1>` styled as the plan name (click to edit).
- On click: replace with `<input type="text">` pre-filled with current name, auto-focused, full border shown.
- On blur or Enter: call `updateDocument({ name: inputValue.trim() || "Untitled Plan" })`.
- On Escape: cancel and restore previous name.

### 6.6 Multiple Plan List UI

Accessible from a "Plans" dropdown in the header (icon: `FolderOpen`). Opens a modal `<PlanListModal>`:

```
┌─────────────────────────────────┐
│  Your Plans              [+ New]│
├─────────────────────────────────┤
│  [●] My Apartment    ✎  🗑      │
│  [ ] Vacation Home   ✎  🗑      │
│  [ ] Office Layout   ✎  🗑      │
└─────────────────────────────────┘
```

- `[●]` = active plan. Clicking a plan name switches to it (calls `loadPlan` from localStorage).
- Rename (pencil icon) shows inline text input.
- Delete (trash icon) shows a confirm prompt (not toast — modal confirm: "Delete 'Plan Name'? This cannot be undone.").
- `[+ New]` calls `newPlan("Untitled Plan")`.

---

## 7. Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `W` | Wall tool |
| `R` | Room tool |
| `D` | Door tool |
| `N` | Window tool |
| `O` | Opening tool (combined door/window) |
| `F` | Furniture tool |
| `M` | Dimension / measurement tool |
| `T` | Text tool |
| `E` | Eraser tool |
| `Space` (hold + drag) | Pan canvas (temporary; works in any tool) |
| `Escape` | Cancel current operation / Deselect / Return to select tool |
| `Delete` / `Backspace` | Delete selected elements |
| `Ctrl/Cmd + A` | Select all (visible, unlocked) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + Y` | Redo (Windows alternative) |
| `Ctrl/Cmd + S` | Force save |
| `Ctrl/Cmd + E` | Export PNG |
| `Scroll wheel` | Zoom in/out (centered on cursor) |
| `Ctrl/Cmd + +` / `-` | Zoom in / out |
| `Ctrl/Cmd + 0` | Reset zoom to 100% |
| `Ctrl/Cmd + Shift + F` | Fit plan to screen |
| `G` | Toggle grid visibility |
| `S` | Toggle snap to grid |
| `Shift` (while drawing wall) | Constrain to orthogonal angles |
| `Shift` (while selecting) | Add to / remove from selection |
| `Shift` (while rotating furniture) | Snap rotation to 15° increments |
| `Alt + drag` | Duplicate selected items |

---

## 8. Canvas Rendering

### 8.1 Render Pipeline (layer order, bottom to top)

```
1.  Background    — solid color (warm off-white #faf9f7 light / dark variant for dark theme)
2.  Grid          — dot or line grid at gridSize intervals (light gray #e0ddd8)
3.  Room fills    — semi-transparent colored polygons
4.  Furniture     — scaled geometric shapes with labels
5.  Wall fills    — opaque wall rectangles (dark charcoal #2d2d2d)
6.  Wall strokes  — border lines on all walls
7.  Openings      — door arcs and window symbols, drawn over walls (creating gaps)
8.  Dimension lines — annotation arrows and distance labels (dark blue #1a3a5c)
9.  Text labels   — user-placed text annotations
10. Room labels   — name + area text at centroid positions
11. Selection UI  — blue bounding boxes, endpoint/midpoint/rotation handles
12. Tool preview  — ghost wall, rubber-band selection, room polygon preview (semi-transparent)
13. Snap indicators — crosshair or circle at active snap target
14. HUD overlay   — scale bar, coordinates, zoom level (rendered in DOM, not canvas)
```

The render function accepts the full plan state and viewport, and redraws the entire canvas. It is called via `requestAnimationFrame` when state changes (not a continuous animation loop).

**`renderer.ts` signature**:
```typescript
interface RenderState {
  plan: Plan;
  viewport: Viewport;
  settings: UserSettings;
  selectedIds: string[];
  hoveredId: string | null;
  ghostPoint: Point | null;
  wallChain: Point[];
  drawingState: DrawingState | null;
  showGrid: boolean;
  layers: Record<LayerName, { visible: boolean; locked: boolean }>;
  pendingFurnitureTemplateId: string | null;
  ppcm: number;  // always 4
}

export function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
): void
```

Each layer draw function (`background.ts`, `grid.ts`, etc.) is a pure function called in the order defined in §8.1. They all accept `(ctx, width, height, state)` or a subset thereof.

### 8.1b Grid Rendering Algorithm

```typescript
// In canvas/layers/grid.ts
function drawGrid(ctx, width, height, viewport, gridSize, ppcm) {
  const zoom = viewport.zoom;
  const cellPx = gridSize * ppcm * zoom;  // grid cell size in screen pixels
  // Skip minor lines when they'd be < 4px apart (too dense)
  const drawMinor = cellPx >= 4;
  const majorCellPx = cellPx * 5;

  // Compute the first visible grid line (in screen coords)
  const startX = ((viewport.panX % majorCellPx) + majorCellPx) % majorCellPx;
  const startY = ((viewport.panY % majorCellPx) + majorCellPx) % majorCellPx;

  ctx.save();
  ctx.globalAlpha = 0.4;
  // Draw minor grid (dots) only when zoomed in enough
  if (drawMinor) {
    ctx.fillStyle = "#e0ddd8";
    for (let x = startX % cellPx; x < width; x += cellPx) {
      for (let y = startY % cellPx; y < height; y += cellPx) {
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);  // 1px dot
      }
    }
  }
  // Draw major grid lines
  ctx.strokeStyle = "#c8c5c0";
  ctx.lineWidth = 0.5;
  for (let x = startX; x < width; x += majorCellPx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = startY; y < height; y += majorCellPx) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
}
```

### 8.1c Zoom Centering Formula

When the user scrolls the wheel at cursor position `(cx, cy)` in screen space:

```typescript
function applyZoom(viewport: Viewport, delta: number, cx: number, cy: number): Viewport {
  const factor = delta > 0 ? 1.1 : 1 / 1.1;  // or use deltaY sign
  const newZoom = Math.max(0.1, Math.min(8.0, viewport.zoom * factor));
  // Keep the world point under cursor fixed:
  const newPanX = cx - (cx - viewport.panX) * (newZoom / viewport.zoom);
  const newPanY = cy - (cy - viewport.panY) * (newZoom / viewport.zoom);
  return { zoom: newZoom, panX: newPanX, panY: newPanY };
}
```

### 8.2 Visual Design

| Element | Light Theme | Dark Theme |
|---|---|---|
| Canvas background | `#faf9f7` | `#1e1e1e` |
| Grid minor (dots) | `#e0ddd8` | `#333333` |
| Grid major (lines) | `#c8c5c0` | `#444444` |
| Walls fill | `#2d2d2d` | `#cccccc` |
| Dimensions text | `#1a3a5c` | `#6ab3f7` |
| Room label text | `#333333` | `#dddddd` |
| Selection highlight | `#2563eb` (blue) | `#3b82f6` |
| Snap indicator | `#22c55e` (green) | `#4ade80` |
| UI background | `#ffffff` | `#252526` |
| UI border | `#e5e7eb` | `#3a3a3a` |
| Accent (active tool) | `#0d9488` (teal) | `#14b8a6` |
| Text (UI) | `#111827` | `#f3f4f6` |

Apply dark theme: when `settings.theme === "dark"`, add class `dark` to `<html>`. Use Tailwind dark mode (`dark:bg-gray-900`, etc.) for UI chrome. Canvas colors are selected based on `settings.theme` inside the render function.

- **Typography**: System font stack `system-ui, -apple-system, sans-serif` for UI. Canvas labels use `ctx.font = "12px system-ui, sans-serif"`. Dimension text: `10px monospace`. Wall length labels: `11px system-ui`.
- **Icons**: lucide-react, size 16px. Active tool icon: accent color fill. All other icons: current text color.

### 8.3 Wall Rendering with Opening Gaps

Walls with openings (doors/windows) must render a gap where the opening sits. Use the following algorithm in `walls.ts` / `openings.ts`:

```
For each wall:
  1. Collect all openings attached to this wall, sorted by their `position` (0.0–1.0).
  2. Build a list of "solid segments" along the wall centerline:
       segments = [(0, pos1 - halfWidth1/wallLen), (pos1 + halfWidth1/wallLen, pos2 - halfWidth2/wallLen), ..., (posN + halfWidthN/wallLen, 1)]
     (clamp all t-values to [0, 1]).
  3. For each solid segment [t_start, t_end]:
       - Compute world points: A = lerp(wall.start, wall.end, t_start), B = lerp(wall.start, wall.end, t_end)
       - Draw a thick rectangle (width = distance(A,B), height = wall.thickness) centered on AB, rotated by wall angle.
  4. Then draw opening symbols on top:
       - Door: draw the door leaf line + quarter-circle arc (see §8.4).
       - Window: draw two parallel lines across the gap.
```

**Wall corner joints**: When two walls share an endpoint, draw a filled square cap at the endpoint using `ctx.lineCap = "square"` and overlap the rectangles so no gap appears at joints. Each wall rectangle is drawn with length extended by `thickness/2` at each endpoint, so overlapping walls naturally fill corners. The visual artifact of overlapping fills is acceptable (same color, no visible seam).

### 8.4 Opening Symbol Rendering

**Door (single-leaf)**:
1. Compute the gap start and end points along the wall: `gapStart = lerp(wall.start, wall.end, position - halfWidth/wallLen)`, `gapEnd = lerp(wall.start, wall.end, position + halfWidth/wallLen)`.
2. Determine which side the arc opens toward based on `flipSide` (use the wall's perpendicular direction).
3. Draw the door leaf: a line from `gapStart` to the hinge point (either `gapStart` or `gapEnd` depending on `swingDirection`).
4. Draw the swing arc: `ctx.arc(hinge, doorWidth, startAngle, endAngle)` where `openAngle` controls the arc sweep (default 90°).
5. Stroke the arc and door leaf in a thin dark line; fill nothing (the gap in the wall is already present from §8.3).

**Window**:
1. Compute gap start/end as above.
2. Draw two parallel lines perpendicular to the wall, each 1/3 of the way across the gap, connecting the inner and outer wall edges. The standard symbol is two short lines inside the gap.

**Sliding door**: Render two equal rectangles overlapping by 50%, each half the opening width, inside the gap.

**Double door**: Two arcs, each starting from the center of the gap, swinging outward in opposite directions.

### 8.5 Furniture Shape Rendering

Each furniture item renders as a **labeled rectangle** by default. In addition, selected furniture types use distinguishing interior lines drawn inside the bounding rectangle:

| Template | Interior Symbol |
|---|---|
| Sofa / Armchair | Horizontal line at 30% depth (backrest line) |
| Bed | Horizontal line at 25% depth (headboard), filled pillow rectangle(s) |
| Dining Table | No interior symbol |
| Chair | Small arc at top 25% (backrest arc) |
| Toilet | Oval inside rectangle (tank + bowl shapes) |
| Bathtub | Inset rectangle (tub lip) + small oval (drain end) |
| Sink (round) | Circle inside square |
| Stove/Oven | 4 small circles (burners) on front half |
| Refrigerator | No interior symbol |
| Desk | No interior symbol |

All symbols are stroked (not filled), in a slightly lighter shade than the item's `color`. The item label is drawn centered in the bounding box at a font size of `min(14, width * ppcm * zoom * 0.15)` pixels, clamped so text is always readable.

### 8.5b Selection Handle Rendering (`canvas/layers/selection.ts`)

Called for each selected element. All handles are drawn in screen space (convert world → screen first).

**Wall selection**:
- Draw a dashed blue bounding rectangle around the wall's thick rect (stroke color `#2563eb`, lineWidth 1.5px, dash: `[4, 3]`).
- **Endpoint handles**: Two filled blue squares (6×6 px) centered on each wall endpoint's screen position. Cursor becomes `move` on hover.
- **Midpoint handle**: One filled white square with blue border (6×6 px) at the wall's midpoint screen position.

**Furniture selection**:
- Draw a solid blue bounding rectangle around the rotated furniture rect (use `ctx.transform` to draw in the furniture's rotated coordinate system).
- **Resize handles**: Four 6×6 px filled blue squares at each corner (in screen coords of the rotated rect corners).
- **Rotation handle**: 8 px radius circle with blue stroke and white fill, positioned 24 px above the top-center of the bounding box (before rotation). A thin blue line connects top-center to the rotation handle.

**Room selection**:
- Highlight the room border with a dashed blue stroke (lineWidth 2px, dash: `[6, 4]`).
- No resize/move handles (drag label to reposition label only; room shape changed by moving walls).

**Dimension line selection**:
- Endpoint handles: 5×5 px filled squares at start and end points.
- Offset handle: 5×5 px diamond at the midpoint of the offset line.

**Text label selection**:
- Dashed bounding box with 4×4 px corner handles.

**Colors** (screen-space, not affected by zoom):
- Handle fill: `#2563eb` (blue) in light theme, `#3b82f6` in dark theme.
- Handle stroke: `#ffffff` (white border, 1px).
- Selection outline stroke: `#2563eb`.

### 8.6 Scale Bar Rendering (`HUD/ScaleBar.tsx`)

The scale bar is a DOM element overlaid on the canvas (not drawn on canvas itself). Target bar width: ~100 screen pixels. Choose a "nice" real-world length:

```typescript
function niceScaleLength(ppcm: number, zoom: number, targetPx = 100): { worldCm: number; label: string } {
  const worldCm = targetPx / (ppcm * zoom);  // exact world length for 100px
  // Round up to a "nice" number: choose from [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
  const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const nice = niceValues.find(v => v >= worldCm) ?? 5000;
  const barPx = nice * ppcm * zoom;  // actual bar width in pixels
  return { worldCm: nice, barPx, label: formatMeasurement(nice, settings.displayUnit) };
}
```

Render as a DOM `<div>` in the bottom-left canvas overlay corner:
- Outer container: `position: absolute; bottom: 16px; left: 16px; display: flex; flex-direction: column; align-items: center`
- Bar: `height: 4px; background: #333; border: 1px solid #333; width: {barPx}px`
- Label below bar: `font-size: 11px; font-family: monospace; color: #333`

### 8.7 Performance Notes

- Only re-render on state change, not continuously.
- For large plans (100+ elements), consider spatial indexing for hit-testing (simple grid-based bucketing).

---

## 9. Interaction Details

### 9.1 Canvas Mouse Events

| Event | Behavior |
|---|---|
| `onMouseDown` | Start drag, start drawing, or select element |
| `onMouseMove` | Update preview, drag element, pan camera |
| `onMouseUp` | Finish drag, place element, commit action |
| `onWheel` | Zoom centered on cursor position |
| `onDoubleClick` | Edit text/label inline, close room polygon |
| `onContextMenu` | Cancel drawing operation / Context menu |

### 9.2 Hit Testing

For each element type, implement `hitTest(element, worldPoint, threshold) → boolean`:

- **Walls**: Point-to-line-segment distance < `thickness/2 + threshold`.
- **Rooms**: Point-in-polygon test (ray casting).
- **Furniture**: Point-in-rotated-rectangle test.
- **Doors/Windows**: Point-to-parent-wall-segment within door/window bounds along the wall.
- **Dimension/Text**: Point-in-bounding-box.

Iterate elements in **reverse render order** (topmost layer first) for selection priority.

### 9.3 Wall Joint Behavior

- When a wall endpoint is moved, any other wall sharing that endpoint follows (auto-join).
- **Lookup implementation**: Do NOT store a separate lookup structure. Instead, derive joined walls on-demand: when moving endpoint `P` of wall `W`, scan all walls where `distance(wall.start, P) < SNAP_MERGE_THRESHOLD` or `distance(wall.end, P) < SNAP_MERGE_THRESHOLD` (use threshold = 1 cm for equality, since endpoints are always stored at snapped grid positions).
- **Coordinate equality**: Two endpoints are "joined" if `distance(a, b) < 1.0` (1 cm). This avoids floating-point exact equality issues.
- When a wall is deleted, doors/windows attached to it are also deleted (with toast notification).
- When moving a wall endpoint drag begins, record all walls that are joined at that endpoint. Move all their matching endpoints together on every mousemove event.

### 9.4 Rubber-Band Selection

Triggered when the user mousedowns on empty canvas in select mode and drags more than 4px.

```
rubberBandStart = mousedown world position
On mousemove:
  rubberBandEnd = current world position
  Draw rubber-band rect (dashed blue border, light blue fill at 10% opacity)
On mouseup:
  rect = { minX, minY, maxX, maxY } = normalize(rubberBandStart, rubberBandEnd)
  For each element in the plan:
    if elementBoundingBox(element).overlaps(rect):
      add element.id to selectedIds
  (Only select from visible, unlocked layers)
  Clear rubberBandStart
```

**Element bounding boxes for rubber-band**:
- Wall: axis-aligned bounding box of the two endpoints (expand by `thickness/2`).
- Room: AABB of all polygon vertices.
- Furniture: AABB of the rotated rectangle (compute rotated corners, then AABB).
- Dimension/Text: AABB of the rendered label.

### 9.5 Opening Placement Hit Test (Clicking on a Wall to Place Opening)

When the door/window tool is active and the user clicks:
1. Find the nearest wall to the click position using `pointToSegmentDist`. Must be within `thickness/2 + 8px` (screen space threshold = 8px / (ppcm * zoom) in world units).
2. Compute `t = nearestPointOnSegment(clickWorld, wall).t` — the parametric position (0–1) along the wall.
3. Validate: the opening must fit (`openingWidth ≤ wallLength - 10 cm`). If it doesn't fit, show a warning toast and do not place.
4. Clamp `t` to keep the opening within bounds: `t = clamp(t, halfWidth/wallLen, 1 - halfWidth/wallLen)`.
5. Create the opening via `addOpening(...)`.

### 9.6 Rotated Rectangle Hit Test (Furniture)

```typescript
function hitTestRotatedRect(p: Point, center: Point, width: number, depth: number, rotationDeg: number): boolean {
  // Translate point into the furniture's local coordinate system
  const cos = Math.cos(-rotationDeg * Math.PI / 180);
  const sin = Math.sin(-rotationDeg * Math.PI / 180);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(localX) <= width / 2 && Math.abs(localY) <= depth / 2;
}
```

---

## 10. Geometry Utilities

Implement the following pure utility functions (no side effects). These are critical for correctness and **must be unit-tested**.

### 10.1 Function Signatures

```typescript
// ─── Point and Vector Math ───
distance(a: Point, b: Point): number
midpoint(a: Point, b: Point): Point
lerp(a: Point, b: Point, t: number): Point
normalize(v: Point): Point
dotProduct(a: Point, b: Point): number
perpendicular(v: Point): Point

// ─── Line/Segment Operations ───
segmentLength(wall: Wall): number
pointOnSegment(p: Point, wall: Wall, tolerance: number): boolean
nearestPointOnSegment(p: Point, wall: Wall): { point: Point, t: number }
segmentsIntersect(w1: Wall, w2: Wall): Point | null
angleOfSegment(wall: Wall): number  // degrees, 0° = right

// ─── Snapping ───
// threshold is in world units (convert from screen px: threshold = screenPx / (ppcm * zoom))
snapToGrid(p: Point, gridSize: number): Point
snapToEndpoints(p: Point, walls: Wall[], threshold: number): SnapResult
snapToMidpoints(p: Point, walls: Wall[], threshold: number): SnapResult
snapToAngle(start: Point, cursor: Point, angles: number[]): Point

// Master snap function: applies all enabled snap types in priority order, returns winner
applySnapping(
  cursor: Point,
  walls: Wall[],
  settings: UserSettings,
  viewport: Viewport,
  ppcm: number
): SnapResult

// ─── Polygon / Room Operations ───
polygonArea(points: Point[]): number           // shoelace formula
polygonCentroid(points: Point[]): Point
isPointInPolygon(p: Point, polygon: Point[]): boolean
wallsToPolygon(walls: Wall[]): Point[]         // extract vertices from ordered wall list

// ─── Polygon / Room Operations ───
// wallsToPolygon: given an ordered list of walls forming a closed loop,
// return the polygon vertices (each wall contributes its `start` point;
// the polygon implicitly closes back to the first point).
// Assumes walls[i].end ≈ walls[i+1].start (snapped endpoints).

// ─── Unit Conversion ───
cmToUnit(cm: number, unit: DisplayUnit): number
unitToCm(value: number, unit: DisplayUnit): number
formatMeasurement(cm: number, unit: DisplayUnit): string  // e.g. "3.5 m", "11' 6\""

// ─── Coordinate Transforms ───
worldToScreen(wx: number, wy: number, camera: Viewport, ppcm: number): Point
screenToWorld(sx: number, sy: number, camera: Viewport, ppcm: number): Point
```

### 10.2 Reference Implementations

```typescript
// Shoelace Formula (Room Area)
function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// Point-to-Segment Distance (Wall Hit Test)
function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

// Point-in-Polygon (Room Hit Test) — Ray Casting
function isPointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Unit Conversion Reference
function cmToUnit(cm: number, unit: DisplayUnit): number {
  if (unit === "m") return cm / 100;
  if (unit === "ft") return cm / 30.48;  // decimal feet
  return cm;  // cm
}
function unitToCm(value: number, unit: DisplayUnit): number {
  if (unit === "m") return value * 100;
  if (unit === "ft") return value * 30.48;
  return value;
}
function formatMeasurement(cm: number, unit: DisplayUnit): string {
  if (unit === "m") return `${(cm / 100).toFixed(2)} m`;
  if (unit === "ft") {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return inches === 12 ? `${feet + 1}' 0"` : `${feet}' ${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}
// Imperial string parser: accepts "12.5" (decimal feet) or "12' 6\"" → decimal cm
function parseImperialInput(input: string): number | null {
  const ftIn = input.match(/^(\d+)'\s*(\d+)"?$/);
  if (ftIn) return (parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54;
  const dec = parseFloat(input);
  if (!isNaN(dec)) return dec * 30.48;
  return null;
}

// Coordinate Transforms
function worldToScreen(wx: number, wy: number, camera: Viewport, ppcm: number): Point {
  return {
    x: wx * ppcm * camera.zoom + camera.panX,
    y: wy * ppcm * camera.zoom + camera.panY,
  };
}

function screenToWorld(sx: number, sy: number, camera: Viewport, ppcm: number): Point {
  return {
    x: (sx - camera.panX) / (ppcm * camera.zoom),
    y: (sy - camera.panY) / (ppcm * camera.zoom),
  };
}

// Snap to Grid
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

// Master Snapping (apply priority order: endpoint > midpoint > angle > grid)
// chainStart is only relevant when drawing walls (for angle snap); pass null otherwise
function applySnapping(
  cursor: Point,
  walls: Wall[],
  settings: UserSettings,
  viewport: Viewport,
  ppcm: number,
  chainStart: Point | null = null,
  shiftHeld = false
): SnapResult {
  const threshold = 12 / (ppcm * viewport.zoom); // 12px in world coords
  if (settings.snapToEndpoint) {
    const r = snapToEndpoints(cursor, walls, threshold);
    if (r.type !== "none") return r;
  }
  if (settings.snapToMidpoint) {
    const r = snapToMidpoints(cursor, walls, threshold);
    if (r.type !== "none") return r;
  }
  if (settings.snapToAngle && chainStart) {
    const angles = shiftHeld
      ? [0, 90, 180, 270]         // orthogonal only when Shift held
      : [0, 45, 90, 135, 180, 225, 270, 315];
    const snapped = snapToAngle(chainStart, cursor, angles);
    if (distance(snapped, cursor) < threshold) {
      return { point: snapped, type: "angle" };
    }
  }
  if (settings.snapToGrid) {
    return {
      point: { x: snapToGrid(cursor.x, settings.defaultGridSize), y: snapToGrid(cursor.y, settings.defaultGridSize) },
      type: "grid"
    };
  }
  return { point: cursor, type: "none" };
}

// Snap to wall endpoints
function snapToEndpoints(cursor: Point, walls: Wall[], threshold: number): SnapResult {
  let best: { dist: number; point: Point; wallId: string } | null = null;
  for (const wall of walls) {
    for (const pt of [wall.start, wall.end]) {
      const d = distance(cursor, pt);
      if (d < threshold && (!best || d < best.dist)) {
        best = { dist: d, point: pt, wallId: wall.id };
      }
    }
  }
  if (best) return { point: best.point, type: "endpoint", targetId: best.wallId };
  return { point: cursor, type: "none" };
}

// Snap to wall midpoints
function snapToMidpoints(cursor: Point, walls: Wall[], threshold: number): SnapResult {
  let best: { dist: number; point: Point; wallId: string } | null = null;
  for (const wall of walls) {
    const mid = midpoint(wall.start, wall.end);
    const d = distance(cursor, mid);
    if (d < threshold && (!best || d < best.dist)) {
      best = { dist: d, point: mid, wallId: wall.id };
    }
  }
  if (best) return { point: best.point, type: "midpoint", targetId: best.wallId };
  return { point: cursor, type: "none" };
}

// Snap to angle: given start point and cursor, snap cursor to nearest of the given angles
function snapToAngle(start: Point, cursor: Point, anglesDeg: number[]): Point {
  const dx = cursor.x - start.x;
  const dy = cursor.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return cursor;  // too close to start, don't snap
  const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;
  const nearest = anglesDeg.reduce((best, a) => {
    // Normalize angle difference to [-180, 180]
    let diff = ((currentAngle - a) % 360 + 360) % 360;
    if (diff > 180) diff -= 360;
    return Math.abs(diff) < Math.abs(best.diff) ? { a, diff } : best;
  }, { a: anglesDeg[0], diff: 360 }).a;
  const rad = nearest * Math.PI / 180;
  return { x: start.x + dist * Math.cos(rad), y: start.y + dist * Math.sin(rad) };
}

// Compute axis-aligned bounding box of all plan elements (in world cm)
function computePlanBBox(plan: Plan): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const w of plan.walls) { expand(w.start); expand(w.end); }
  for (const r of plan.rooms) r.points.forEach(expand);
  for (const f of plan.furniture) {
    expand({ x: f.position.x - f.width / 2, y: f.position.y - f.depth / 2 });
    expand({ x: f.position.x + f.width / 2, y: f.position.y + f.depth / 2 });
  }
  for (const d of plan.dimensions) { expand(d.start); expand(d.end); }
  // Default if plan is empty:
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: plan.width, maxY: plan.height };
  return { minX, minY, maxX, maxY };
}

// fitToScreen: compute viewport to show all plan elements with padding
function fitToScreen(plan: Plan, canvasWidth: number, canvasHeight: number, ppcm: number): Viewport {
  const padding = 40;
  const bbox = computePlanBBox(plan);
  const worldW = bbox.maxX - bbox.minX;
  const worldH = bbox.maxY - bbox.minY;
  if (worldW < 1 || worldH < 1) return { zoom: 1.0, panX: 0, panY: 0 };
  const zoomX = (canvasWidth - padding * 2) / (worldW * ppcm);
  const zoomY = (canvasHeight - padding * 2) / (worldH * ppcm);
  const zoom = Math.max(0.1, Math.min(8.0, Math.min(zoomX, zoomY)));
  const panX = (canvasWidth - worldW * ppcm * zoom) / 2 - bbox.minX * ppcm * zoom;
  const panY = (canvasHeight - worldH * ppcm * zoom) / 2 - bbox.minY * ppcm * zoom;
  return { zoom, panX, panY };
}

// Compute "solid" wall segments around openings (for gap rendering)
function wallSolidSegments(wall: Wall, openings: Opening[]): Array<[number, number]> {
  const wallLen = distance(wall.start, wall.end);
  const gaps = openings
    .filter(o => o.wallId === wall.id)
    .map(o => {
      const halfT = (o.width / 2) / wallLen;
      return [Math.max(0, o.position - halfT), Math.min(1, o.position + halfT)] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  const solid: Array<[number, number]> = [];
  let cursor = 0;
  for (const [gapStart, gapEnd] of gaps) {
    if (gapStart > cursor) solid.push([cursor, gapStart]);
    cursor = gapEnd;
  }
  if (cursor < 1) solid.push([cursor, 1]);
  return solid;
}
```

---

## 11. State Management (Zustand)

### 11.1 Store Shape

```typescript
interface AppState {
  // ─── Plan Data ───
  activePlanId: string | null;
  plans: Record<string, Plan>;

  // ─── Editor State ───
  selectedIds: string[];
  hoveredId: string | null;
  activeTool: ToolType;
  drawingState: DrawingState | null;  // transient state while drawing (see §4.9)
  wallChain: Point[];                 // committed wall chain points (the chain start + all intermediate endpoints placed so far; the last point is the start of the next preview segment)
  ghostPoint: Point | null;           // current cursor snapped world position (updates on every mousemove; NOT in undo history)

  // ─── Settings ───
  settings: UserSettings;

  // ─── UI State ───
  // Note: snap/unit/theme/grid settings live in `settings: UserSettings` (see §4.10).
  // Top-level UI-only flags (not in UserSettings):
  showGrid: boolean;               // default true (separate from snap; grid can be hidden but snap still active)
  layers: Record<LayerName, { visible: boolean; locked: boolean }>;
  pendingFurnitureTemplateId: string | null;  // set when user clicks a furniture template in the panel; cleared after placing on canvas
  toasts: Toast[];                 // active toast notifications (see §11.4)

  // ─── Derived / convenience (not stored; computed from settings) ───
  // Access via settings.snapToGrid, settings.snapToEndpoint, etc.

  // ─── History (Undo/Redo) ───
  past: Plan[];                       // previous plan state snapshots
  future: Plan[];                     // redo snapshots

  // ─── Actions ───
  addWall(start: Point, end: Point): void;
  updateWall(id: string, changes: Partial<Wall>): void;
  deleteWall(id: string): void;
  addOpening(opening: Omit<Opening, "id">): void;
  updateOpening(id: string, changes: Partial<Opening>): void;
  deleteOpening(id: string): void;
  addRoom(room: Omit<Room, "id">): void;
  updateRoom(id: string, changes: Partial<Room>): void;
  deleteRoom(id: string): void;
  addFurniture(item: Omit<FurnitureItem, "id">): void;
  updateFurniture(id: string, changes: Partial<FurnitureItem>): void;
  deleteFurniture(id: string): void;
  addDimension(dim: Omit<DimensionLine, "id">): void;
  updateDimension(id: string, changes: Partial<DimensionLine>): void;
  deleteDimension(id: string): void;
  addTextLabel(label: Omit<TextLabel, "id">): void;
  updateTextLabel(id: string, changes: Partial<TextLabel>): void;
  deleteTextLabel(id: string): void;
  updateElement(id: string, changes: Record<string, any>): void;  // generic: dispatches to the correct typed updater based on element type
  deleteElements(ids: string[]): void;  // cascades: deleting a wall also deletes its openings; deleting a room's boundary walls removes the room
  moveElements(ids: string[], dx: number, dy: number): void;
  // moveElements behavior per type:
  //   Wall: translate both start and end by (dx, dy); also scan all other walls joined at those endpoints and move them too
  //   Room: translate all room.points by (dx, dy) and room.labelPosition
  //   FurnitureItem: translate position by (dx, dy)
  //   DimensionLine: translate start, end, and labelPosition by (dx, dy); clear wallId attachments (they no longer track walls)
  //   TextLabel: translate position by (dx, dy)
  //   Opening: cannot be moved independently — it moves with its parent wall
  setSelectedIds(ids: string[]): void;
  setHoveredId(id: string | null): void;
  setActiveTool(tool: ToolType): void;
  setPendingFurnitureTemplate(templateId: string | null): void;
  setDrawingState(state: DrawingState | null): void;
  setGhostPoint(p: Point | null): void;
  pushToChain(p: Point): void;
  clearChain(): void;
  setCamera(changes: Partial<Viewport>): void;
  setLayer(name: LayerName, changes: { visible?: boolean; locked?: boolean }): void;
  undo(): void;
  redo(): void;
  loadPlan(plan: Plan): void;
  deletePlan(id: string): void;
  newPlan(name: string): void;
  switchPlan(id: string): void;
  updateSettings(changes: Partial<UserSettings>): void;
  updateDocument(changes: Partial<Pick<Plan, "name" | "unit" | "gridSize" | "width" | "height">>): void;
  // Toast notifications (see §11.4):
  addToast(message: string, type?: Toast["type"], durationMs?: number): void;
  dismissToast(id: string): void;
  // UI helpers (no undo history):
  toggleShowGrid(): void;            // flips showGrid boolean
  toggleSnapToGrid(): void;          // flips settings.snapToGrid
  forceSave(): void;                 // immediately writes to localStorage (no debounce)
  selectAll(): void;                 // selects all visible, unlocked elements
  zoomIn(): void;                    // zoom *= 1.25, clamped to 8.0×
  zoomOut(): void;                   // zoom /= 1.25, clamped to 0.1×
  fitToScreen(canvasWidth: number, canvasHeight: number): void;  // fits all plan elements with 40px padding
}

type ToolType = "select" | "wall" | "room" | "door" | "window" | "opening" | "furniture" | "dimension" | "text" | "eraser" | "pan";

type LayerName = "structure" | "furniture" | "annotations";
```

### 11.2 Mutation Rules

Every mutation action must:
1. Push the current plan state snapshot `plans[activePlanId]` onto `past` (deep clone via `structuredClone` or JSON parse/stringify).
2. Clear `future` (set to `[]`).
3. Apply the mutation to `plans[activePlanId]`.
4. Trigger auto-save debounce.

Viewport changes (`setCamera`) are **not** recorded in undo history.

**Undo/redo implementation pattern**:
```typescript
// In Zustand store (simplified):
undo: () => set(state => {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, -1);
  return {
    past: newPast,
    plans: { ...state.plans, [state.activePlanId!]: previous },
    future: [state.plans[state.activePlanId!], ...state.future].slice(0, 100),
  };
}),
redo: () => set(state => {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    past: [...state.past, state.plans[state.activePlanId!]].slice(-100),
    plans: { ...state.plans, [state.activePlanId!]: next },
    future: state.future.slice(1),
  };
}),
```

Use a helper `withHistory(set, get, mutation)` wrapper for all plan mutations to avoid repeating the push/clear pattern.

### 11.3 localStorage Keys

```
floorplanner:settings          → UserSettings JSON
floorplanner:plans             → Record<string, Plan> JSON (all plans)
floorplanner:activePlanId      → string
```

On first load: if no plans exist, create and store `DEFAULT_PLAN`.

### 11.4 Toast Notification System

Use a simple custom toast implementation (no external library). Add to `AppState`:

```typescript
interface Toast {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
  durationMs: number;  // default 3000
}
// In AppState:
toasts: Toast[];
addToast(message: string, type?: Toast["type"], durationMs?: number): void;
dismissToast(id: string): void;
```

Render `<ToastContainer>` in `App.tsx` as a fixed-position overlay (bottom-right). Each toast auto-dismisses after `durationMs`. Add `<ToastContainer />` to the component tree and `ToastContainer.tsx` to `components/`.

---

## 12. Component Tree

```
<App>
  <Header>
    <PlanNameEditor />
    <UndoRedoButtons />
    <SaveStatus />
    <SettingsButton />
    <ExportMenu />        // dropdown: "Export PNG (1×/2×/4×)", "Export JSON", "Import JSON"
  </Header>
  <WorkspaceLayout>
    <LeftSidebar>
      <Toolbar />                    // vertical icon strip for tools
      <RoomsPanel />                 // collapsible accordion
      <FurniturePanel />             // collapsible accordion
      <LayerPanel />                 // collapsible accordion
    </LeftSidebar>
    <CanvasContainer>
      <Canvas ref={canvasRef} />     // the HTML5 canvas element
      <CanvasHUD>                    // DOM overlay for non-canvas UI
        <ScaleBar />
        <CoordinateDisplay />
        <ZoomControls />
      </CanvasHUD>
    </CanvasContainer>
    <PropertiesPanel />              // right panel, context-sensitive
  </WorkspaceLayout>
  <StatusBar />
  <SettingsModal />          // shown when settings gear icon clicked
  <NewPlanModal />           // shown when "New Plan" triggered
  <PlanListModal />          // shown when "Plans" dropdown header icon clicked (§6.6)
  <ToastContainer />         // fixed bottom-right overlay, auto-dismisses (§11.4)
</App>
```

---

## 13. File Structure

```
src/
  main.tsx                     # entry point
  App.tsx                      # root component, layout
  store/
    index.ts                   # Zustand store definition
    actions.ts                 # action implementations (if split)
    history.ts                 # undo/redo middleware
  types/
    plan.ts                    # Plan, Wall, Room, Opening, FurnitureItem, DimensionLine, TextLabel, Viewport, Point
    tools.ts                   # ToolType, DrawingState, SnapResult  (see §4.9, §4.11 for full definitions)
    settings.ts                # UserSettings  (see §4.10 for full definition)
  canvas/
    useCanvas.ts               # React hook: manages canvas ref, resize observer
    renderer.ts                # render(ctx, w, h, state): void — pure; calls all layer draw functions in order (see §8.1)
    layers/
      background.ts
      grid.ts
      rooms.ts
      walls.ts
      openings.ts
      furniture.ts
      dimensions.ts
      textLabels.ts
      labels.ts
      selection.ts
      preview.ts
      snapIndicators.ts
    interaction/
      useMouseEvents.ts        # canvas mouse event handler hook
      useTouchEvents.ts        # pinch-to-zoom, touch pan
      useKeyboardShortcuts.ts  # global keyboard handler hook
      hitTest.ts               # hit testing for all element types
  geometry/
    point.ts                   # distance, midpoint, lerp, normalize, dot, perpendicular
    segment.ts                 # segmentLength, pointOnSegment, nearestPoint, intersect, angle
    polygon.ts                 # polygonArea, centroid, pointInPolygon, wallsToPolygon
    snapping.ts                # snapToGrid, snapToEndpoints, snapToMidpoints, snapToAngle
    units.ts                   # cmToUnit, unitToCm, formatMeasurement
    transforms.ts              # worldToScreen, screenToWorld
  components/
    Header/
      index.tsx
      PlanNameEditor.tsx
      SaveStatus.tsx
      ExportMenu.tsx
    Toolbar/
      index.tsx
      ToolButton.tsx
    Panels/
      RoomsPanel.tsx
      FurniturePanel.tsx
      LayerPanel.tsx
      PropertiesPanel/
        index.tsx
        WallProperties.tsx
        RoomProperties.tsx
        OpeningProperties.tsx
        FurnitureProperties.tsx
        DimensionProperties.tsx
        TextProperties.tsx
        DocumentProperties.tsx
    HUD/
      ScaleBar.tsx              # bottom-left; shows real-world scale bar (see §8.6)
      CoordinateDisplay.tsx     # bottom-right; shows "x: 3.50 m  y: 2.10 m" from ghostPoint
      ZoomControls.tsx          # bottom-right corner; [−] [100%] [+] buttons; clicking % resets to 100%
    StatusBar.tsx
    Modals/
      SettingsModal.tsx          # settings: units, grid, snap, theme, wall thickness default
      NewPlanModal.tsx           # single text field: plan name; Create / Cancel
      PlanListModal.tsx          # plan list with switch/rename/delete (§6.6)
      ConfirmDialog.tsx          # reusable: message, Confirm/Cancel buttons
    ToastContainer.tsx           # renders toasts from store.toasts
  data/
    furnitureLibrary.ts        # built-in furniture templates (FurnitureTemplate[])
    roomColors.ts              # ROOM_COLORS: string[] — 8 muted architectural pastels (see below)
    defaultSettings.ts         # DEFAULT_SETTINGS: UserSettings — all defaults
  utils/
    uuid.ts                    # export function uuid(): string — uses crypto.randomUUID() with fallback
    localStorage.ts            # typed read/write helpers; catches QuotaExceededError
    export/
      exportPng.ts             # exportPng(plan, settings, options) — see F11.5
      exportJson.ts            # exportJson(plan): void — JSON.stringify + download
  hooks/
    usePlanPersistence.ts      # auto-save logic (debounced localStorage)
  styles/
    index.css                  # Tailwind base + custom canvas cursor styles
```

### 13a. PropertiesPanel Layout (`components/Panels/PropertiesPanel/`)

The PropertiesPanel is a ~250px wide right sidebar. It dispatches to a sub-component based on what's selected:

```
selected.length === 0  → <DocumentProperties />    (doc name, unit, grid size, doc W/H)
selected.length > 1    → <MultiSelectProperties />  (shows count: "3 items selected"; Move/Delete actions)
selected type = wall   → <WallProperties />
selected type = room   → <RoomProperties />
selected type = opening→ <OpeningProperties />
selected type = furniture → <FurnitureProperties />
selected type = dimension → <DimensionProperties />
selected type = text   → <TextProperties />
```

Each sub-component renders a vertical form with labeled rows using this pattern:

```tsx
// Shared form row component:
<div className="flex items-center gap-2 py-1">
  <label className="text-xs text-gray-500 w-24 shrink-0">{label}</label>
  <input className="flex-1 border rounded px-2 py-1 text-sm" ... />
</div>
```

**WallProperties fields** (in order):
1. Length (number input, in display unit; editing adjusts `end` point along wall direction)
2. Thickness (number input, cm)
3. Layer (select: "exterior" / "interior")
4. Color (color swatch + `<input type="color">`)
5. Start X, Start Y (number inputs, display unit; read-write)
6. End X, End Y (number inputs, display unit; read-write)

**RoomProperties fields**:
1. Name (text input)
2. Fill Color (color swatch)
3. Area (read-only, formatted in display unit)
4. Show Area (checkbox)
5. Show Label (checkbox)

**OpeningProperties fields**:
1. Type (select: door/window/sliding-door/double-door/bay-window)
2. Width (number, cm)
3. Position (number, distance from wall start in display unit)
4. Swing Direction (select, only for doors)
5. Open Angle (number 0-180, only for doors)
6. Flip Side (checkbox)

**FurnitureProperties fields**:
1. Label (text)
2. Width × Depth (two number inputs side by side)
3. Position X, Y (number, display unit)
4. Rotation (number, degrees)
5. Color (color swatch)
6. Lock (checkbox)

**DocumentProperties fields** (shown when nothing selected):
1. Plan Name
2. Display Unit (radio: cm / m / ft)
3. Grid Size (number)
4. Wall Thickness Default (number)
5. Document Width × Height (two number inputs)

---

## 13b. Key Hook APIs

### `useCanvas` Hook (`canvas/useCanvas.ts`)

Manages the canvas element reference, its pixel dimensions, and triggers re-renders via `requestAnimationFrame`.

```typescript
function useCanvas(
  renderFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
): React.RefObject<HTMLCanvasElement>
```

- Attaches a `ResizeObserver` to the canvas's parent container.
- On resize, sets the canvas pixel dimensions for HiDPI:
  ```typescript
  const dpr = window.devicePixelRatio || 1;
  canvas.width = containerWidth * dpr;
  canvas.height = containerHeight * dpr;
  canvas.style.width = containerWidth + "px";
  canvas.style.height = containerHeight + "px";
  ctx.scale(dpr, dpr);  // applied once after resize, before any draw calls
  ```
  The `width` and `height` values passed to `renderFn` are the CSS pixel dimensions (not physical pixels). The `dpr` scale is transparent to the render code.
- Calls `renderFn` once immediately and then whenever `renderFn` changes identity (use `useCallback` with the full state as dependencies in the consumer).
- Uses `requestAnimationFrame` for scheduling — if multiple state changes arrive in the same frame, only one render fires. Implement with a `rafId` ref: cancel previous pending RAF before scheduling a new one.
- Returns the `canvasRef` to be spread onto `<canvas ref={canvasRef} />`.

Usage in `CanvasContainer`:
```tsx
const canvasRef = useCanvas(useCallback((ctx, w, h) => {
  render(ctx, w, h, storeState);
}, [storeState]));
```

### `useKeyboardShortcuts` Hook (`canvas/interaction/useKeyboardShortcuts.ts`)

```typescript
function useKeyboardShortcuts(): void
```

Attaches a `keydown` listener to `window`. Must be called once in `App.tsx`. Handles:

```typescript
// Pseudocode — implement as a switch/if chain on event.key + modifiers
const isMac = navigator.platform.includes("Mac");
const ctrl = isMac ? event.metaKey : event.ctrlKey;

switch (event.key) {
  case "v": case "V": setActiveTool("select"); break;
  case "w": case "W": setActiveTool("wall"); break;
  case "r": case "R": setActiveTool("room"); break;
  case "d": case "D": setActiveTool("door"); break;
  case "n": case "N": setActiveTool("window"); break;
  case "f": case "F": setActiveTool("furniture"); break;
  case "m": case "M": setActiveTool("dimension"); break;
  case "t": case "T": setActiveTool("text"); break;
  case "e": case "E": setActiveTool("eraser"); break;
  case "g": case "G": toggleShowGrid(); break;
  case "s": case "S": if (!ctrl) toggleSnapToGrid(); break;
  case "Escape": handleEscape(); break;   // cancel op or deselect
  case "Delete": case "Backspace": deleteElements(selectedIds); break;
  case "z": if (ctrl && event.shiftKey) redo(); else if (ctrl) undo(); break;
  case "y": if (ctrl) redo(); break;
  case "a": if (ctrl) selectAll(); break;
  case "s": if (ctrl) forceSave(); break;
  case "e": if (ctrl) exportPng(); break;
  case "0": if (ctrl) setCamera({ zoom: 1.0, panX: 0, panY: 0 }); break;  // reset zoom
  case "+": case "=": if (ctrl) zoomIn(); break;
  case "-": if (ctrl) zoomOut(); break;
  case "f": case "F": if (ctrl && event.shiftKey) fitToScreen(); break;
}

// Space key: handled via keydown/keyup to enable pan mode temporarily
// keydown Space: if not in text input, set pan cursor; set isPanMode = true
// keyup Space: restore previous tool cursor; set isPanMode = false
```

Guard: do not trigger shortcuts when focus is inside an `<input>`, `<textarea>`, or `contenteditable` element (`event.target.tagName` check).

`handleEscape()`:
- If in wall chain drawing: clear chain, clear ghost point.
- If in any other drawing mode: set tool to "select", clear drawing state.
- If elements are selected: clear selection.

`fitToScreen()`: Compute the bounding box of all plan elements; set `panX`, `panY`, `zoom` to show all elements with 40px padding.

### `useMouseEvents` Hook (`canvas/interaction/useMouseEvents.ts`)

Attaches all mouse event handlers to the canvas element and dispatches tool-specific logic.

```typescript
function useMouseEvents(canvasRef: React.RefObject<HTMLCanvasElement>): void
```

Internally calls the appropriate handler based on `activeTool`:

| Tool | mousedown | mousemove | mouseup | dblclick |
|---|---|---|---|---|
| select | hit-test → select or start rubber-band or start drag | move drag / update rubber-band | finish drag / commit rubber-band | enter text edit |
| wall | place chain point | update ghost point + snap | — | end chain |
| room | place polygon vertex | update ghost polygon | — | close polygon |
| door/window | find wall + place opening | hover highlight wall | — | — |
| furniture | place pending furniture | — | — | — |
| dimension | place start point | update ghost end | place end point | — |
| text | place text label + open edit | — | — | — |
| eraser | delete element at cursor | — | — | — |
| pan | start pan drag | apply pan | end pan | — |

All handlers: convert `MouseEvent` position to world coords via `screenToWorld`, apply snapping, then dispatch store actions.

### `useTouchEvents` Hook (`canvas/interaction/useTouchEvents.ts`)

Handles pinch-to-zoom and single-finger pan on touch devices.

```typescript
function useTouchEvents(canvasRef: React.RefObject<HTMLCanvasElement>): void
```

```typescript
// Implementation:
let lastTouchDist = 0;
let lastTouchMidpoint = { x: 0, y: 0 };

onTouchStart(e):
  if (e.touches.length === 2):
    lastTouchDist = dist(e.touches[0], e.touches[1])
    lastTouchMidpoint = midpoint(e.touches[0], e.touches[1])
  elif e.touches.length === 1:
    // treat as mouse down for current tool (convert to world coords)

onTouchMove(e):
  e.preventDefault()
  if (e.touches.length === 2):
    const newDist = dist(e.touches[0], e.touches[1])
    const newMid = midpoint(e.touches[0], e.touches[1])
    const scale = newDist / lastTouchDist
    // apply zoom at midpoint: applyZoom(viewport, scale > 1 ? -1 : 1, newMid.x, newMid.y)
    // apply pan: delta = newMid - lastTouchMidpoint
    lastTouchDist = newDist
    lastTouchMidpoint = newMid
  elif e.touches.length === 1:
    // treat as mouse move for pan (if space-pan active) or tool preview

onTouchEnd(e): clear touch state
```

Pass `{ passive: false }` to the `touchmove` listener to allow `preventDefault()`.

### `usePlanPersistence` Hook (`hooks/usePlanPersistence.ts`)

```typescript
function usePlanPersistence(): void
```

- Subscribes to the Zustand store.
- On plan mutation, debounces a write to `localStorage` with 500 ms delay.
- Also writes on `beforeunload`.
- On mount, reads `localStorage` and calls `loadPlan` if a saved plan exists.
- Catches `QuotaExceededError` and dispatches a toast notification.

---

## 13c. Static Data Values

### Room Color Palette (`data/roomColors.ts`)

```typescript
export const ROOM_COLORS = [
  "#e8f4e8",  // sage green
  "#e8eef8",  // periwinkle blue
  "#fdf3e3",  // warm cream
  "#f8e8f0",  // dusty rose
  "#e8f4f8",  // ice blue
  "#f3f0e8",  // linen
  "#f0e8f8",  // lavender
  "#eaf8ea",  // mint
];
// Used cyclically when creating rooms (room index % ROOM_COLORS.length).
// All colors have alpha 0.5 applied at render time: ctx.globalAlpha = 0.5.
```

### Default Settings (`data/defaultSettings.ts`)

```typescript
export const DEFAULT_SETTINGS: UserSettings = {
  displayUnit: "cm",
  defaultWallThickness: 15,    // cm
  defaultGridSize: 10,         // cm
  snapToGrid: true,
  snapToEndpoint: true,
  snapToMidpoint: false,
  snapToAngle: true,
  showDimensions: true,
  theme: "light",
};
```

### Default Plan (`store/index.ts` initial state)

```typescript
const DEFAULT_PLAN: Plan = {
  id: uuid(),
  name: "Untitled Plan",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  unit: "cm",
  gridSize: 10,
  width: 1200,   // 12 m default document width
  height: 800,   // 8 m default document height
  walls: [],
  rooms: [],
  openings: [],
  furniture: [],
  dimensions: [],
  textLabels: [],
  viewport: { panX: 0, panY: 0, zoom: 1.0 },
};
```

### `utils/localStorage.ts`

```typescript
const KEYS = {
  settings: "floorplanner:settings",
  plans: "floorplanner:plans",
  activePlanId: "floorplanner:activePlanId",
} as const;

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Caller should handle this (addToast in usePlanPersistence)
      throw e;
    }
  }
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
```

### `utils/uuid.ts`

```typescript
export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments:
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

---

## 14. Implementation Phases

### Phase 1 — Foundation (Core Canvas + Wall Drawing)

1. Scaffold Vite + React + TypeScript + Tailwind project.
2. Implement all types: `Plan`, `Wall`, `Point`, `Viewport`, etc.
3. Create Zustand store with `addWall`, `updateWall`, `deleteWall`, undo/redo.
4. Build `useCanvas` hook with resize handling and `renderer.ts` calling `requestAnimationFrame`.
5. Implement canvas rendering: background, grid (minor + major lines), camera transforms (pan, zoom).
6. Implement wall layer rendering (thick rectangle along line segment, with stroke).
7. Implement `useMouseEvents` for wall tool: click-to-start, move-to-preview, click-to-commit, double-click/Escape/right-click to end chain, chained drawing.
8. Implement snapping: grid snap, endpoint snap, angle snap (with Shift constraint).
9. Implement pan (Space + drag, middle-mouse drag) and zoom (scroll wheel, centered on cursor).
10. Display wall length labels on drawn walls.
11. Render coordinate HUD, scale bar, and status bar.
12. Implement basic `localStorage` persistence (single plan).
13. Implement undo/redo.
14. Basic keyboard shortcuts (`W`, `Escape`, `Ctrl+Z`, `Ctrl+Shift+Z`).

**Deliverable**: User can draw walls with snapping, pan, zoom, see dimensions, and see the plan persist across reloads.

### Phase 2 — Selection, Editing & Rooms

1. Implement select tool (`V`) with click-to-select.
2. Hit testing for walls (point-to-thick-line-segment).
3. Render selection handles on selected walls (start endpoint, end endpoint, midpoint).
4. Drag endpoint handles to move wall endpoints (with auto-join for connected walls).
5. Drag midpoint handle to translate entire wall.
6. Multi-select with Shift-click and rubber-band drag.
7. Delete selected with Delete key.
8. Properties Panel: show wall properties; allow editing length, thickness, etc.
9. Room tool: polygon drawing, closing, auto-label.
10. Auto-room creation when wall chain closes.
11. Room rendering: filled polygon with area label at centroid.
12. Room properties: name, color picker, computed area (read-only).
13. Rooms Panel listing all rooms.
14. Layer panel with visibility/lock toggles.

**Deliverable**: User can select, edit, move walls, and create rooms with accurate area calculations.

### Phase 3 — Openings, Furniture & Annotations

1. Door tool: click on wall to place, render swing arc and gap.
2. Window tool: click on wall to place, render window symbol and gap.
3. Properties panel for openings (width, type, swing direction, flip side).
4. Wall-door/window attachment logic (gap rendering, cascade delete).
5. Furniture Panel with built-in library, organized by category.
6. Click-to-place furniture from palette.
7. Furniture rendering (geometric shapes with labels).
8. Furniture selection, move, rotate (handles + properties panel), resize.
9. Alt+drag to duplicate furniture.
10. Dimension tool: click two points, render dimension line with arrows and label.
11. Text tool: click to place, inline editing.
12. Eraser tool.

**Deliverable**: Complete floor plan elements — rooms, doors, windows, furniture, annotations.

### Phase 4 — Export, Import & Polish

1. PNG export with title block (document name, scale, date, unit) at configurable resolution.
2. JSON export/import (`.floorplan.json`) with schema validation.
3. Multiple plan management (plan list, new plan, switch, delete).
4. Unit switching (cm ↔ m ↔ ft/in) with value conversion throughout.
5. Settings modal (units, grid size, snap toggles, theme, wall thickness default).
6. Scale bar rendering on canvas.
7. Dark theme support.
8. `Ctrl+A` select all. `Ctrl+S` save. `Ctrl+E` export.
9. Responsive toolbar collapsing for smaller screens.
10. Help modal with keyboard shortcut reference.
11. Toast notifications for destructive actions (door/window cascade delete).

**Deliverable**: Production-quality floor plan tool with full import/export, settings, and polish.

---

## 15. Measurement & Accuracy System

### 15.1 Units

- Support **Imperial** (feet + inches, displayed as `12' 6"`) and **Metric** (centimeters `380 cm`, meters `3.80 m`).
- Internally, all values stored as **centimeters** (decimal).
- Unit switcher in document settings converts all *displayed* values — stored values remain in cm.

### 15.2 Scale

- `ppcm` = pixels per world centimeter. Default: 4 px/cm.
- User adjusts zoom via `camera.zoom` multiplier.
- Display a scale bar on the canvas (a ruler graphic showing a fixed-length bar with real-world label).

### 15.3 Input Precision

- Properties panel inputs accept decimal values.
- Imperial mode: Allow input as `12.5` (feet decimal) or `12' 6"` (feet-inches string). Parse both formats and store as decimal cm.
- Metric mode: Accept cm or m with automatic conversion.

### 15.4 Area Calculation

- Room area via shoelace formula on polygon vertices (in cm²).
- Display in ft², m², or cm² depending on unit setting.
- Displayed at the centroid of the room polygon.

### 15.5 Wall Length

- Calculated as Euclidean distance between endpoints (in cm).
- Auto-displayed on each wall when `showDimensions` is true.

---

## 16. Edge Cases & Validation Rules

- **Zero-length walls**: Reject wall commits where `distance(start, end) < 1 cm`.
- **Duplicate walls**: Warn (but allow) if an identical wall already exists between two points.
- **Overlapping walls**: Allow but do not auto-merge (user responsibility). Warn in status bar.
- **Opening overflow**: Clamp opening width to `wallLength − 10 cm`; show validation message.
- **Floating openings**: If a parent wall is resized such that the opening no longer fits, clamp its position.
- **Orphan doors/windows**: If parent wall is deleted, cascade-delete attached openings and notify user via brief toast.
- **Room polygon winding**: Always normalize to counter-clockwise winding before area computation.
- **Self-intersecting rooms**: Warn user. Minimum 3 vertices for a room polygon.
- **Plan size**: Soft-warn if plan bounding box exceeds 10,000 cm (100 m) in either axis.
- **Zoom limits**: Clamp zoom between 0.1× and 8.0×.
- **Undo history**: Cap at 100 snapshots to manage memory. Drop oldest entries.
- **localStorage quota**: Catch `QuotaExceededError` and prompt user to export and clear old plans.
- **Canvas size**: Handle documents up to ~200 m × 200 m without performance issues.
- **Browser support**: Target modern evergreen browsers (Chrome, Firefox, Safari, Edge). No IE support.

---

## 17. Accessibility

- All toolbar buttons have `aria-label` attributes.
- Keyboard shortcuts are the primary alternative to mouse interactions (see §7).
- Modals trap focus and can be closed with `Escape`.
- Color choices for room fills must pass AA contrast ratio against the label text.
- The properties panel is keyboard-navigable (Tab through fields, Enter to confirm).
- Tool icons include tooltip text with keyboard shortcut hint.

---

## 18. Testing Considerations

### 18.1 Test File Structure

Co-locate unit tests with source files using the `.test.ts` suffix, resolved by Vitest:

```
src/
  geometry/
    point.test.ts         # tests for distance, midpoint, lerp, normalize, etc.
    segment.test.ts       # tests for pointOnSegment, nearestPoint, intersect, angle
    polygon.test.ts       # tests for polygonArea, centroid, isPointInPolygon
    snapping.test.ts      # tests for snapToGrid, snapToEndpoints, applySnapping
    units.test.ts         # tests for cmToUnit, unitToCm, formatMeasurement, parseImperialInput
    transforms.test.ts    # tests for worldToScreen, screenToWorld (round-trip)
  store/
    history.test.ts       # tests for undo/redo: add walls, undo, verify state
```

Run all tests: `npx vitest run`. Run with watch: `npx vitest`.

### 18.2 Key Test Cases

```typescript
// point.test.ts
test("distance between (0,0) and (300,0) is 300", () => {
  expect(distance({ x: 0, y: 0 }, { x: 300, y: 0 })).toBe(300);
});

// units.test.ts
test("300 cm = 3.00 m", () => expect(cmToUnit(300, "m")).toBeCloseTo(3.0));
test("300 cm = 9' 10\"", () => expect(formatMeasurement(300, "ft")).toBe("9' 10\""));
test("parseImperialInput(\"12' 6\\\"\") = 381", () => {
  expect(parseImperialInput("12' 6\"")).toBeCloseTo(381);
});

// polygon.test.ts
test("area of 300×360 cm rectangle = 108000 cm²", () => {
  const pts = [{ x:0,y:0 }, { x:300,y:0 }, { x:300,y:360 }, { x:0,y:360 }];
  expect(polygonArea(pts)).toBe(108000);
});

// snapping.test.ts
test("snapToGrid(13, 10) = 10", () => expect(snapToGrid(13, 10)).toBe(10));
test("snapToGrid(16, 10) = 20", () => expect(snapToGrid(16, 10)).toBe(20));

// transforms.test.ts
test("worldToScreen then screenToWorld round-trips", () => {
  const vp = { zoom: 2, panX: 50, panY: 30 };
  const p = { x: 100, y: 200 };
  const s = worldToScreen(p.x, p.y, vp, 4);
  const back = screenToWorld(s.x, s.y, vp, 4);
  expect(back.x).toBeCloseTo(p.x);
  expect(back.y).toBeCloseTo(p.y);
});

// history.test.ts
test("undo removes last wall", () => {
  const store = createStore();
  store.addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
  store.addWall({ x: 100, y: 0 }, { x: 200, y: 0 });
  expect(store.plans[store.activePlanId!].walls).toHaveLength(2);
  store.undo();
  expect(store.plans[store.activePlanId!].walls).toHaveLength(1);
});
```

---

## 19. Non-Goals (MVP Exclusions)

- Real-time collaboration / multi-user editing
- Cloud storage or user accounts
- 3D view or perspective rendering
- Structural engineering calculations (load-bearing, materials)
- Electrical, plumbing, or HVAC plan layers
- Mobile-first layout (touch-only input is a future enhancement; touch pan/zoom is still included)
- Curved walls
- Custom furniture shape import (SVG upload)
- DXF/DWG import or export

---

## 20. Project Bootstrap & Configuration

### 20.1 `package.json` Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.400.0",
    "jspdf": "^2.5.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

### 20.2 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### 20.3 `tailwind.config.js`

```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#0d9488',  // teal accent
      },
    },
  },
  plugins: [],
};
```

### 20.4 `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FloorPlanner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 20.5 `src/styles/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom canvas cursor styles */
canvas { cursor: default; }
canvas[data-tool="wall"] { cursor: crosshair; }
canvas[data-tool="room"] { cursor: crosshair; }
canvas[data-tool="door"] { cursor: cell; }
canvas[data-tool="window"] { cursor: cell; }
canvas[data-tool="eraser"] { cursor: cell; }
canvas[data-tool="pan"] { cursor: grab; }
canvas[data-tool="pan"][data-dragging="true"] { cursor: grabbing; }
canvas[data-tool="furniture"] { cursor: copy; }
canvas[data-tool="dimension"] { cursor: crosshair; }
canvas[data-tool="text"] { cursor: text; }
```

---

## 21. Stretch Goals (Post-MVP)

- **Copy/paste** elements
- **Snap to wall alignment** (extend projection lines to help align walls)
- **Auto-room detection** (detect enclosed wall polygons and auto-generate room fills)
- **Multiple floors/levels** with a floor switcher
- **3D preview** (isometric or basic Three.js rendering of the plan extruded to wall height)
- **Templates** (pre-built room shapes: rectangular room, L-shaped room, etc.)
- **SVG export** for vector editing in Illustrator/Inkscape
- **Touch/tablet support** with gesture controls
- **Collaboration** via shared state (would require a backend)
- **Drag-from-palette** furniture placement (in addition to click-to-place)
