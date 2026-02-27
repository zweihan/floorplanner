import { worldToScreen, screenToWorld, applyZoom } from './transforms';

const makeCamera = (panX: number, panY: number, zoom: number) => ({ panX, panY, zoom });

describe('worldToScreen', () => {
  test('origin with identity camera → (0,0)', () => {
    const result = worldToScreen(0, 0, makeCamera(0, 0, 1), 4);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  test('(100,0) at zoom=1 pan=(0,0) ppcm=4 → (400,0)', () => {
    const result = worldToScreen(100, 0, makeCamera(0, 0, 1), 4);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(0);
  });
});

describe('round-trips', () => {
  test('worldToScreen then screenToWorld at zoom=2 pan=(50,30) ppcm=4', () => {
    const camera = makeCamera(50, 30, 2);
    const ppcm = 4;
    const wx = 75, wy = 40;
    const screen = worldToScreen(wx, wy, camera, ppcm);
    const world = screenToWorld(screen.x, screen.y, camera, ppcm);
    expect(world.x).toBeCloseTo(wx, 4);
    expect(world.y).toBeCloseTo(wy, 4);
  });

  test('screenToWorld then worldToScreen at zoom=0.5 pan=(-100,200) ppcm=4', () => {
    const camera = makeCamera(-100, 200, 0.5);
    const ppcm = 4;
    const sx = 320, sy = 240;
    const world = screenToWorld(sx, sy, camera, ppcm);
    const screen = worldToScreen(world.x, world.y, camera, ppcm);
    expect(screen.x).toBeCloseTo(sx, 4);
    expect(screen.y).toBeCloseTo(sy, 4);
  });
});

describe('applyZoom', () => {
  test('deltaY > 0 (scroll down) → zoom decreases', () => {
    const vp = makeCamera(0, 0, 1);
    const result = applyZoom(vp, 1, 400, 300);
    expect(result.zoom).toBeLessThan(1);
  });

  test('deltaY < 0 (scroll up) → zoom increases', () => {
    const vp = makeCamera(0, 0, 1);
    const result = applyZoom(vp, -1, 400, 300);
    expect(result.zoom).toBeGreaterThan(1);
  });

  test('cursor world position stays fixed after zoom', () => {
    const ppcm = 4;
    const vp = makeCamera(0, 0, 1);
    const cx = 400, cy = 300;
    // World position under cursor before zoom
    const worldBefore = screenToWorld(cx, cy, vp, ppcm);
    // Apply zoom
    const newVp = applyZoom(vp, -1, cx, cy);
    // Screen position of same world point after zoom
    const screenAfter = worldToScreen(worldBefore.x, worldBefore.y, newVp, ppcm);
    expect(screenAfter.x).toBeCloseTo(cx, 4);
    expect(screenAfter.y).toBeCloseTo(cy, 4);
  });

  test('clamps to max zoom 8.0', () => {
    const vp = makeCamera(0, 0, 7.5);
    const result = applyZoom(vp, -1, 400, 300);
    expect(result.zoom).toBeLessThanOrEqual(8);
  });

  test('clamps to min zoom 0.1', () => {
    const vp = makeCamera(0, 0, 0.11);
    const result = applyZoom(vp, 1, 400, 300);
    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
  });
});
