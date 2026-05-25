# MEP Furniture Symbols Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 new architectural symbol items across three new categories (Electrical, Plumbing, HVAC) using the existing furniture/placed-symbol system.

**Architecture:** Two files only. `furnitureTemplates.ts` gets 9 new entries. `furniture.ts` gets 9 new `case` blocks in `_drawShape`. No new data types, no new tools, no new store actions — pure extension of the existing furniture pipeline.

**Tech Stack:** TypeScript, HTML5 Canvas 2D API, Vite, Vitest.

---

## New items summary

| ID | Label | Category | Default W×D (cm) | Fill color |
|---|---|---|---|---|
| `lamp` | Lamp | Electrical | 30×30 | `#fff9c4` (pale yellow) |
| `outlet` | Outlet | Electrical | 10×10 | `#e0e0e0` (light grey) |
| `switch` | Switch | Electrical | 10×10 | `#e0e0e0` |
| `pipe-supply` | Supply Pipe | Plumbing | 100×6 | `#b3d9f5` (light blue) |
| `pipe-drain` | Drain Pipe | Plumbing | 100×8 | `#c8bfa8` (warm grey) |
| `valve` | Valve | Plumbing | 15×15 | `#f5c6c6` (light red) |
| `ac-indoor` | AC Indoor Unit | HVAC | 80×20 | `#d0eaf5` (pale cyan) |
| `ac-duct` | Coolant Duct | HVAC | 100×8 | `#d5e8d4` (pale green) |
| `ac-drain` | Condensate Drain | HVAC | 100×6 | `#dae8fc` (pale blue) |

---

## Symbol drawing specs (all drawn in local coords, origin = item centre)

### `lamp`
- Fill item rect with `fillColor`; stroke outer rect
- Draw filled circle radius `min(hw,hd)*0.35`, `fillColor` darkened 0.1
- Draw 8 radiating lines from radius `0.4*r` to `0.85*r` at 45° increments, `strokeColor`, lineWidth 1

### `outlet`
- Fill outer rect, stroke it
- Draw two small vertical rects (the socket slots) side by side, each `hw*0.18` wide × `hd*0.4` tall, centred, filled `strokeColor`

### `switch`
- Fill circle radius `min(hw,hd)*0.8`, `fillColor`; stroke it
- Draw a diagonal line from bottom-left (`-r*0.5, r*0.5`) to top-right (`r*0.5, -r*0.5`)
- Draw small filled circle (dot) at (`r*0.5, -r*0.5`), radius `r*0.12`, `strokeColor`

### `pipe-supply`
- Fill outer rect `fillColor`, stroke with solid `strokeColor`
- Draw a right-pointing arrow along the centreline:
  - Shaft: line from `(-hw*0.5, 0)` to `(hw*0.4, 0)`
  - Arrowhead: filled triangle tip at `(hw*0.6, 0)`, base width `hd*0.6`

### `pipe-drain`
- Fill outer rect `fillColor`, stroke with **dashed** line `[4,3]`
- Draw a left-pointing arrow (drain flows away): same as supply but pointing left (`-hw*0.6`)
- Reset dash after

### `valve`
- Fill outer rect `fillColor`, stroke it
- Draw bowtie: two filled triangles tip-to-tip at centre:
  - Left triangle: vertices `(-hw, -hd)`, `(-hw, hd)`, `(0, 0)`
  - Right triangle: vertices `(hw, -hd)`, `(hw, hd)`, `(0, 0)`
  - Fill both with `darken(fillColor, 0.15)`, stroke `strokeColor`

### `ac-indoor`
- Fill outer rect `fillColor`, stroke it
- Draw 3 evenly-spaced horizontal lines across the width at 25%, 50%, 75% of height (airflow slots)
- Draw a small arc (fan symbol) at one end: semicircle radius `hd*0.5` centred at `(-hw*0.7, 0)`

### `ac-duct`
- Fill outer rect `fillColor`, stroke it
- Draw diagonal hatching lines at 45°, spaced `hd*0.8` apart, clipped to rect
  - Use `ctx.save()` / `ctx.clip()` with the rect path, then draw lines, then `ctx.restore()`

### `ac-drain`
- Fill outer rect `fillColor`, stroke with dashed line `[3,3]`
- Draw 5 evenly-spaced filled dots along the centreline (y=0), radius `Math.min(hd*0.25, 3px)`, filled `strokeColor`

---

## Task 1 — Add templates to `furnitureTemplates.ts`

**File:** `src/data/furnitureTemplates.ts`

**Step 1: Add the 9 entries to `FURNITURE_TEMPLATES`**

Append after the last `cabinet` entry:

```ts
  // Electrical
  { id: 'lamp',    label: 'Lamp',    category: 'Electrical', defaultWidth: 30,  defaultDepth:  30, defaultColor: '#fff9c4' },
  { id: 'outlet',  label: 'Outlet',  category: 'Electrical', defaultWidth: 10,  defaultDepth:  10, defaultColor: '#e0e0e0' },
  { id: 'switch',  label: 'Switch',  category: 'Electrical', defaultWidth: 10,  defaultDepth:  10, defaultColor: '#e0e0e0' },
  // Plumbing
  { id: 'pipe-supply', label: 'Supply Pipe', category: 'Plumbing', defaultWidth: 100, defaultDepth:  6, defaultColor: '#b3d9f5' },
  { id: 'pipe-drain',  label: 'Drain Pipe',  category: 'Plumbing', defaultWidth: 100, defaultDepth:  8, defaultColor: '#c8bfa8' },
  { id: 'valve',       label: 'Valve',       category: 'Plumbing', defaultWidth:  15, defaultDepth: 15, defaultColor: '#f5c6c6' },
  // HVAC
  { id: 'ac-indoor', label: 'AC Indoor Unit',    category: 'HVAC', defaultWidth:  80, defaultDepth: 20, defaultColor: '#d0eaf5' },
  { id: 'ac-duct',   label: 'Coolant Duct',      category: 'HVAC', defaultWidth: 100, defaultDepth:  8, defaultColor: '#d5e8d4' },
  { id: 'ac-drain',  label: 'Condensate Drain',  category: 'HVAC', defaultWidth: 100, defaultDepth:  6, defaultColor: '#dae8fc' },
```

**Step 2: Verify compile**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 3: Verify tests still pass**
```bash
npx vitest run
```
Expected: 136 passed.

---

## Task 2 — Draw `lamp` and `outlet` in `_drawShape`

**File:** `src/canvas/layers/furniture.ts`

Add two `case` blocks inside the `switch (templateId)` statement, before the `default` case.

**`lamp`:**
```ts
case 'lamp': {
  // Background disc
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  const r = Math.min(hw, hd);
  // Centre disc
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = darken(fillColor, 0.1);
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  // 8 radiating lines
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  break;
}
```

**`outlet`:**
```ts
case 'outlet': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  // Two socket slots
  const sw = hw * 0.18;
  const sh = hd * 0.4;
  ctx.fillStyle = strokeColor;
  ctx.fillRect(-hw * 0.4 - sw / 2, -sh, sw, sh * 2);
  ctx.fillRect( hw * 0.4 - sw / 2, -sh, sw, sh * 2);
  break;
}
```

**Step: Verify compile + tests**
```bash
npx tsc --noEmit && npx vitest run
```

---

## Task 3 — Draw `switch` and `pipe-supply`

**`switch`:**
```ts
case 'switch': {
  const r = Math.min(hw, hd) * 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  // Diagonal line (switch lever)
  ctx.beginPath();
  ctx.moveTo(-r * 0.5,  r * 0.5);
  ctx.lineTo( r * 0.5, -r * 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
  // Dot at tip
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.5, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  break;
}
```

**`pipe-supply`:**
```ts
case 'pipe-supply': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  // Right-pointing arrow along centreline
  const tipX = hw * 0.65;
  const tailX = -hw * 0.5;
  const arrowHalfH = hd * 0.55;
  ctx.fillStyle = darken(fillColor, 0.25);
  ctx.strokeStyle = strokeColor;
  // Shaft
  ctx.beginPath();
  ctx.moveTo(tailX, 0);
  ctx.lineTo(tipX - arrowHalfH, 0);
  ctx.lineWidth = Math.max(1, hd * 0.3);
  ctx.stroke();
  ctx.lineWidth = 1;
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(tipX, 0);
  ctx.lineTo(tipX - arrowHalfH, -arrowHalfH);
  ctx.lineTo(tipX - arrowHalfH,  arrowHalfH);
  ctx.closePath();
  ctx.fill();
  break;
}
```

**Step: Verify compile + tests**
```bash
npx tsc --noEmit && npx vitest run
```

---

## Task 4 — Draw `pipe-drain` and `valve`

**`pipe-drain`:**
```ts
case 'pipe-drain': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  // Dashed outline
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  ctx.setLineDash([]);
  // Left-pointing arrow
  const tipX = -hw * 0.65;
  const tailX = hw * 0.5;
  const arrowHalfH = hd * 0.55;
  ctx.fillStyle = darken(fillColor, 0.25);
  ctx.beginPath();
  ctx.moveTo(tipX, 0);
  ctx.lineTo(tipX + arrowHalfH, -arrowHalfH);
  ctx.lineTo(tipX + arrowHalfH,  arrowHalfH);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tailX, 0);
  ctx.lineTo(tipX + arrowHalfH, 0);
  ctx.lineWidth = Math.max(1, hd * 0.3);
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.lineWidth = 1;
  break;
}
```

**`valve`:**
```ts
case 'valve': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  // Bowtie — two filled triangles tip-to-tip
  ctx.fillStyle = darken(fillColor, 0.15);
  // Left triangle
  ctx.beginPath();
  ctx.moveTo(-hw * 0.9, -hd * 0.8);
  ctx.lineTo(-hw * 0.9,  hd * 0.8);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  // Right triangle
  ctx.beginPath();
  ctx.moveTo(hw * 0.9, -hd * 0.8);
  ctx.lineTo(hw * 0.9,  hd * 0.8);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  break;
}
```

**Step: Verify compile + tests**
```bash
npx tsc --noEmit && npx vitest run
```

---

## Task 5 — Draw `ac-indoor`, `ac-duct`, `ac-drain`

**`ac-indoor`:**
```ts
case 'ac-indoor': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  // 3 airflow slot lines
  for (const t of [0.25, 0.5, 0.75]) {
    const y = -hd + t * hd * 2;
    ctx.beginPath();
    ctx.moveTo(-hw + hw * 0.35, y);
    ctx.lineTo(hw - 2, y);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Fan arc at left end
  ctx.beginPath();
  ctx.arc(-hw * 0.65, 0, hd * 0.6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  break;
}
```

**`ac-duct`:**
```ts
case 'ac-duct': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  // Diagonal hatching (45°), clipped to rect
  ctx.save();
  ctx.beginPath();
  ctx.rect(-hw, -hd, hw * 2, hd * 2);
  ctx.clip();
  const spacing = Math.max(hd * 0.9, 4);
  ctx.lineWidth = 0.75;
  for (let x = -hw * 2; x < hw * 2; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, -hd);
    ctx.lineTo(x + hd * 2, hd);
    ctx.stroke();
  }
  ctx.restore();
  break;
}
```

**`ac-drain`:**
```ts
case 'ac-drain': {
  ctx.fillStyle = fillColor;
  ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = strokeColor;
  ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  ctx.setLineDash([]);
  // 5 dots along centreline
  const dotR = Math.min(hd * 0.25, 3);
  ctx.fillStyle = strokeColor;
  for (let i = 0; i < 5; i++) {
    const x = -hw * 0.7 + (i / 4) * hw * 1.4;
    ctx.beginPath();
    ctx.arc(x, 0, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  break;
}
```

**Step: Final compile + full test run**
```bash
npx tsc --noEmit && npx vitest run
```
Expected: 0 errors, 136 tests pass.

---

## Task 6 — Commit

```bash
git add src/data/furnitureTemplates.ts src/canvas/layers/furniture.ts
git commit -m "feat: add Electrical, Plumbing, HVAC furniture symbol categories"
```

---

## Verification checklist

- [ ] `npm run dev` → FurniturePanel shows 3 new accordion sections: Electrical, Plumbing, HVAC
- [ ] Place a Lamp → circle with 8 rays renders correctly
- [ ] Place a Supply Pipe → thin blue rect with right-pointing arrow; rotate 90° to run vertically
- [ ] Place an AC Duct → hatched green rect
- [ ] Place a Valve → bowtie symbol inside rect
- [ ] `tsc --noEmit` clean
- [ ] 136/136 tests pass
