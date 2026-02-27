---
name: phase-scaffold
description: Scaffold the next implementation phase for the floorplanner project. Use when starting a new implementation phase (1=Foundation, 2=Rooms & Openings, 3=Furniture & Dimensions, 4=Polish & Export). Creates TypeScript stubs only — no implementation logic.
---

You are scaffolding an implementation phase for the floorplanner project.

## Steps

1. Ask the user which phase to scaffold (1–4) if not already specified.
2. Read FINAL_PROJECT.md — find the phase description and the relevant sections:
   - Phase 1 (Foundation): §13 file structure, §4 types, §11 store, §8.1 renderer
   - Phase 2 (Rooms & Openings): §4.3 Room, §4.4 Opening, §9 interactions
   - Phase 3 (Furniture & Dimensions): §4.5 Furniture, §4.6 Dimension, §10 snap/geometry
   - Phase 4 (Polish & Export): §6 UI components, §11.3 persistence, §F11 export
3. Read §13 (file structure) for the exact paths to create.
4. For each file in the phase, create a stub with:
   - Correct TypeScript imports (from spec §4 types)
   - Exported function/class shells with correct signatures (no body — just `throw new Error('not implemented')`)
   - A comment at the top: `// Phase N stub — see FINAL_PROJECT.md §[section]`

## Rules

- Do NOT implement any logic. Stubs only.
- Do NOT modify existing files unless adding a new export.
- Create `index.ts` barrel files where the spec shows them.
- Use the exact type names from FINAL_PROJECT.md §4 (e.g., `Point`, `Wall`, `Room`, `AppState`).
- After scaffolding, list all created files and the next suggested action.

## Output

End with a summary table:

| File | Phase Section | Status |
|------|--------------|--------|
| src/types/index.ts | §4 | created |
| ... | ... | ... |
