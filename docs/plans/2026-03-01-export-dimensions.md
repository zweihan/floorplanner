# Export Dimensions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Include wall labels" checkbox to the Export menu and a PDF export option, both including wall length labels.

**Architecture:** `computeExportBounds` becomes exported (testable); `exportPNG` gains an `includeDimensions: boolean` param replacing the `showDimensions` gate; a new `exportPDF` function reuses the same offscreen canvas pipeline and writes to a jsPDF document; `ExportMenu` gets a checkbox state and a PDF section.

**Tech Stack:** jsPDF 2.x (already in `package.json`), Vitest + jsdom for tests.

---

### Task 1: Export `computeExportBounds` and add unit tests

**Files:**
- Modify: `src/canvas/export.ts` (line 16 — change `function` to `export function`)
- Create: `src/canvas/export.test.ts`

**Step 1: Make `computeExportBounds` exported**

In `src/canvas/export.ts`, change line 16 from:
```ts
function computeExportBounds(plan: Plan): ...
```
to:
```ts
export function computeExportBounds(plan: Plan): ...
```

**Step 2: Write tests**

Create `src/canvas/export.test.ts`:
```ts
import { describe, test, expect } from 'vitest';
import { computeExportBounds } from './export';
import type { Plan } from '../types/plan';

const emptyPlan: Plan = {
  id: 'p1', name: 'Test', width: 500, height: 400,
  walls: [], rooms: [], furniture: [], openings: [],
  dimensions: [], textLabels: [],
};

describe('computeExportBounds', () => {
  test('falls back to plan dims when no elements', () => {
    const b = computeExportBounds(emptyPlan);
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 500, maxY: 400 });
  });

  test('uses wall endpoints', () => {
    const plan: Plan = {
      ...emptyPlan,
      walls: [{
        id: 'w1', start: { x: 10, y: 20 }, end: { x: 200, y: 150 },
        thickness: 15, layer: 'structure', openingIds: [],
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(10);
    expect(b.minY).toBe(20);
    expect(b.maxX).toBe(200);
    expect(b.maxY).toBe(150);
  });

  test('includes furniture extents (position ± half-size)', () => {
    const plan: Plan = {
      ...emptyPlan,
      furniture: [{
        id: 'f1', templateId: 'sofa', label: 'Sofa',
        position: { x: 100, y: 100 }, width: 60, depth: 40,
        rotation: 0, layer: 'furniture',
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(70);  // 100 - 30
    expect(b.maxX).toBe(130); // 100 + 30
    expect(b.minY).toBe(80);  // 100 - 20
    expect(b.maxY).toBe(120); // 100 + 20
  });

  test('includes dimension line endpoints', () => {
    const plan: Plan = {
      ...emptyPlan,
      dimensions: [{
        id: 'd1', start: { x: 5, y: 5 }, end: { x: 300, y: 200 }, offset: 12, overrideText: null,
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(5);
    expect(b.maxX).toBe(300);
  });
});
```

**Step 3: Run tests to verify they pass**

```bash
npx vitest run src/canvas/export.test.ts
```
Expected: all 4 tests PASS.

**Step 4: Commit**

```bash
git add src/canvas/export.ts src/canvas/export.test.ts
git commit -m "test: add computeExportBounds unit tests"
```

---

### Task 2: Add `includeDimensions` param to `exportPNG`

**Files:**
- Modify: `src/canvas/export.ts` (lines 58–100)

**Step 1: Update the function signature and gate**

In `src/canvas/export.ts`, update `exportPNG`:

```ts
export function exportPNG(
  plan: Plan,
  settings: UserSettings,
  scale: 1 | 2 | 4 = 1,
  includeDimensions = true,
): void {
  // ... existing setup unchanged ...

  // Replace the old gate:
  //   if (exportSettings.showDimensions) { drawWallLabels(...) }
  // with:
  if (includeDimensions) {
    drawWallLabels(ctx, plan.walls, viewport, exportSettings);
  }

  // ... rest unchanged ...
}
```

The only change is:
1. Add `includeDimensions = true` parameter after `scale`.
2. Change `if (exportSettings.showDimensions)` → `if (includeDimensions)`.

**Step 2: Run existing tests to make sure nothing broke**

```bash
npx vitest run src/canvas/export.test.ts
```
Expected: all tests still PASS (they don't call `exportPNG` directly, so no impact).

**Step 3: Commit**

```bash
git add src/canvas/export.ts
git commit -m "feat: add includeDimensions param to exportPNG"
```

---

### Task 3: Add `exportPDF` function

**Files:**
- Modify: `src/canvas/export.ts` (append after `exportPNG`)

**Step 1: Write the function**

Append to `src/canvas/export.ts`:

```ts
/**
 * Render the plan to an off-screen canvas and trigger a PDF download via jsPDF.
 * The PDF page is sized to match the plan's natural aspect ratio.
 * @param plan              The plan to export
 * @param settings          User settings (theme, displayUnit, etc.)
 * @param includeDimensions Whether to draw wall length labels
 */
export async function exportPDF(
  plan: Plan,
  settings: UserSettings,
  includeDimensions = true,
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const bounds = computeExportBounds(plan);
  const contentW = bounds.maxX - bounds.minX + EXPORT_PADDING_CM * 2;
  const contentH = bounds.maxY - bounds.minY + EXPORT_PADDING_CM * 2;

  // Render at 2× pixel density for crisp PDF embedding
  const scale = 2;
  const pxW = Math.round(contentW * PPCM * scale);
  const pxH = Math.round(contentH * PPCM * scale);

  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const viewport = {
    panX: (EXPORT_PADDING_CM - bounds.minX) * PPCM * scale,
    panY: (EXPORT_PADDING_CM - bounds.minY) * PPCM * scale,
    zoom: scale,
  };

  const exportSettings: UserSettings = { ...settings, theme: 'light' };

  drawBackground(ctx, pxW, pxH, exportSettings);
  drawRooms(ctx, plan.rooms, viewport, exportSettings, PPCM);
  drawFurniture(ctx, plan.furniture, viewport, exportSettings, PPCM);
  drawWalls(ctx, plan.walls, plan.openings, viewport, exportSettings, PPCM);
  drawOpenings(ctx, plan.walls, plan.openings, viewport, exportSettings, PPCM);
  drawDimensions(ctx, plan.dimensions, viewport, exportSettings, PPCM);
  drawTextLabels(ctx, plan.textLabels, viewport, PPCM, null);
  if (includeDimensions) {
    drawWallLabels(ctx, plan.walls, viewport, exportSettings);
  }

  const dataUrl = canvas.toDataURL('image/png');

  // PDF page size in mm — use plan's natural aspect ratio
  const MM_PER_CM = 10;
  const widthMm = contentW * MM_PER_CM;
  const heightMm = contentH * MM_PER_CM;
  const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  doc.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm);

  const safeFileName = plan.name.replace(/[^a-z0-9_\-]/gi, '_') || 'floorplan';
  doc.save(`${safeFileName}.pdf`);
}
```

**Note on the import:** `jsPDF` is imported dynamically (`await import('jspdf')`) so it's lazy-loaded only when the user triggers a PDF export. This avoids adding ~300KB to the initial bundle.

**Step 2: Run the tests to make sure nothing broke**

```bash
npx vitest run src/canvas/export.test.ts
```
Expected: all tests still PASS.

**Step 3: Commit**

```bash
git add src/canvas/export.ts
git commit -m "feat: add exportPDF function using jsPDF"
```

---

### Task 4: Update `ExportMenu` with checkbox and PDF button

**Files:**
- Modify: `src/components/ExportMenu.tsx`

**Step 1: Read the current ExportMenu state**

The file is at `src/components/ExportMenu.tsx`. Current imports include only `exportPNG`.

**Step 2: Apply the changes**

The complete updated `ExportMenu.tsx`:

```tsx
import { useRef, useState } from 'react';
import { useStore } from '../store';
import { exportPNG, exportPDF } from '../canvas/export';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePlanId = useStore(s => s.activePlanId);
  const plans = useStore(s => s.plans);
  const settings = useStore(s => s.settings);
  const exportJSON = useStore(s => s.exportJSON);
  const importJSON = useStore(s => s.importJSON);
  const addToast = useStore(s => s.addToast);

  function handleExportPNG(scale: 1 | 2 | 4) {
    if (!activePlanId) return;
    setOpen(false);
    exportPNG(plans[activePlanId], settings, scale, includeDimensions);
  }

  async function handleExportPDF() {
    if (!activePlanId) return;
    setOpen(false);
    await exportPDF(plans[activePlanId], settings, includeDimensions);
  }

  function handleExportJSON() {
    setOpen(false);
    const json = exportJSON();
    const activePlan = activePlanId ? plans[activePlanId] : null;
    const fileName = (activePlan?.name ?? 'floorplan').replace(/[^a-z0-9_\-]/gi, '_') + '.json';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON() {
    setOpen(false);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const err = importJSON(text);
      if (err) {
        addToast(err, 'error');
      } else {
        addToast('Plan imported successfully.', 'info');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-7 px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1"
      >
        Export ▾
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded shadow-lg py-1 w-48">

            {/* Options */}
            <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={includeDimensions}
                onChange={e => setIncludeDimensions(e.target.checked)}
                className="accent-blue-600"
              />
              Wall labels
            </label>
            <hr className="my-1 border-gray-100" />

            {/* PNG */}
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">PNG</div>
            {([1, 2, 4] as const).map(scale => (
              <button
                key={scale}
                onClick={() => handleExportPNG(scale)}
                className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
              >
                Export PNG {scale}×
              </button>
            ))}
            <hr className="my-1 border-gray-100" />

            {/* PDF */}
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">PDF</div>
            <button
              onClick={handleExportPDF}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Export PDF
            </button>
            <hr className="my-1 border-gray-100" />

            {/* JSON */}
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">JSON</div>
            <button
              onClick={handleExportJSON}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Export JSON
            </button>
            <button
              onClick={handleImportJSON}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50"
            >
              Import JSON…
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/components/ExportMenu.tsx
git commit -m "feat: add wall labels checkbox and PDF export to ExportMenu"
```

---

### Task 5: Manual smoke test

Open the app in the browser (`npm run dev`) and verify:

1. Open the Export menu — a "Wall labels" checkbox appears at top, checked by default.
2. **PNG with labels:** Checkbox checked → Export PNG 1× → open the file → wall length labels visible.
3. **PNG without labels:** Uncheck → Export PNG 1× → open the file → no wall labels.
4. **PDF export:** Export PDF → file `<planname>.pdf` downloads → open in PDF viewer → plan renders with labels matching checkbox state.
5. **Plan name with spaces:** Rename plan to "My Floor Plan" → export → filename is `My_Floor_Plan.pdf`.

No automated test needed for the visual output — the unit tests cover the bounds logic and the TypeScript check covers the wiring.
