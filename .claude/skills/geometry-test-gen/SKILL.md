---
name: geometry-test-gen
description: Generate Vitest unit tests for a pure geometry or utility function in the floorplanner project. Use when adding or completing any function in src/utils/ (point.ts, geometry.ts, units.ts, snap.ts, hitTest.ts, etc.).
---

You are generating co-located Vitest unit tests for a floorplanner geometry utility.

## Steps

1. Read the target function from the file provided (or ask the user which function to test).
2. Read FINAL_PROJECT.md §18 for the expected test file structure and patterns.
3. Generate a `.test.ts` file co-located with the source file (same directory, same base name).

## Test requirements per the spec

- **Edge cases**: zero-length input, collinear points, parallel lines, division by zero guards
- **Round-trip invariants**: e.g., `unitToCm(cmToUnit(x)) === x`
- **Known-value assertions**: hardcoded numeric expectations — NOT snapshots
- **No side effects**: all tested functions must be pure (no store, no DOM)
- Import from `vitest`: `describe`, `it`, `expect`
- Use `toBeCloseTo` for floating-point geometry results (tolerance: 4 decimal places)

## File naming

Source: `src/utils/point.ts` → Test: `src/utils/point.test.ts`

## Example structure

```typescript
import { describe, it, expect } from 'vitest';
import { distance, midpoint } from './point';

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
  it('returns correct Euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 4);
  });
});
```

After generating, remind the user to run `npx vitest run src/utils/[file].test.ts` to verify.
