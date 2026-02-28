# Export Dimensions Design

**Date:** 2026-03-01
**Status:** Approved

## Problem

PNG export omits wall length labels when the "Show Dimensions" setting is off, even though users typically want measurement annotations in exported files. There is also no PDF export option.

## Goals

1. Add an "Include wall labels" checkbox to the Export menu that controls whether auto-generated wall length labels appear in all exports (PNG and PDF).
2. Add PDF export using `jsPDF`, reusing the existing offscreen canvas render pipeline.

## Non-Goals

- SVG export
- Changing the in-editor "Show Dimensions" toggle behavior
- Changing how user-placed dimension lines work (they already always export)

---

## Design

### 1. Wall Labels Export Option

**`src/canvas/export.ts`**

`exportPNG` gains a new parameter: `includeDimensions: boolean`.

- When `true`: `drawWallLabels` is called unconditionally regardless of `settings.showDimensions`.
- When `false`: `drawWallLabels` is not called.
- Replace the current `if (exportSettings.showDimensions)` gate with `if (includeDimensions)`.

Same parameter added to `exportPDF` (see below).

**`src/components/ExportMenu.tsx`**

- Add local state: `const [includeDimensions, setIncludeDimensions] = useState(true)`
- Render a checkbox at the top of the Export dropdown: "Include wall labels"
- Pass `includeDimensions` to both `exportPNG` and `exportPDF` calls.

---

### 2. PDF Export

**Dependency**

```
npm install jspdf
```

`jsPDF` ships its own TypeScript types.

**`src/canvas/export.ts` — new `exportPDF` function**

```ts
export function exportPDF(plan: Plan, settings: UserSettings, includeDimensions: boolean): void
```

Algorithm:
1. `computeExportBounds(plan)` → same bounds as PNG.
2. Render to an offscreen canvas at **2× pixel density** using the same layer draw calls as `exportPNG` (with `scale = 2`).
3. Call `canvas.toDataURL('image/png')` to get the image.
4. Compute PDF page dimensions in mm:
   - Content width in cm → convert to mm.
   - Choose orientation: landscape if `contentW > contentH`, else portrait.
   - Use the plan's natural aspect ratio for page size (not A4) so no blank margins.
5. `new jsPDF({ orientation, unit: 'mm', format: [widthMm, heightMm] })`
6. `doc.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm)`
7. `doc.save('<safeFileName>.pdf')`

**`src/components/ExportMenu.tsx`**

Add a "PDF" section to the Export dropdown with a single "Export PDF" button. The existing `includeDimensions` checkbox (Section 1) controls PDF too.

---

## File Changes

| File | Change |
|------|--------|
| `src/canvas/export.ts` | Add `includeDimensions: boolean` param to `exportPNG`; add `exportPDF` function |
| `src/components/ExportMenu.tsx` | Add `includeDimensions` state + checkbox; add PDF section; update PNG calls |
| `package.json` | Add `jspdf` dependency |

---

## Testing

- Export PNG with checkbox checked → wall labels visible in exported image.
- Export PNG with checkbox unchecked → wall labels absent.
- Export PDF → file downloads, plan renders correctly, wall labels controlled by checkbox.
- Plan name with special characters → safe filename used.
