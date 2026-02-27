import { snapToGrid, snapToEndpoints, snapToMidpoints, applySnapping } from './snapping';
import type { Wall } from '../types/plan';
import type { UserSettings } from '../types/settings';

const allOff: UserSettings = {
  displayUnit: 'cm',
  defaultWallThickness: 15,
  defaultGridSize: 10,
  snapToGrid: false,
  snapToEndpoint: false,
  snapToMidpoint: false,
  snapToAngle: false,
  showDimensions: true,
  theme: 'light',
};

const gridOnly: UserSettings = { ...allOff, snapToGrid: true };
const endpointOnly: UserSettings = { ...allOff, snapToEndpoint: true };

const viewport = { panX: 0, panY: 0, zoom: 1 };

const wall: Wall = {
  id: 'w1',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  thickness: 15,
  height: 244,
  color: '#2d2d2d',
  layer: 'interior',
};

// threshold at zoom=1, ppcm=4: 12 / (4*1) = 3 cm
const ppcm = 4;

describe('snapToGrid', () => {
  test('13 snaps to 10', () => {
    expect(snapToGrid(13, 10)).toBe(10);
  });

  test('16 snaps to 20', () => {
    expect(snapToGrid(16, 10)).toBe(20);
  });

  test('15 snaps to 20 (ties round up with Math.round)', () => {
    expect(snapToGrid(15, 10)).toBe(20);
  });

  test('0 snaps to 0', () => {
    expect(snapToGrid(0, 10)).toBe(0);
  });
});

describe('snapToEndpoints', () => {
  test('cursor at (1,0) within threshold=3 of wall start (0,0) → endpoint (0,0)', () => {
    const result = snapToEndpoints({ x: 1, y: 0 }, [wall], 3);
    expect(result.type).toBe('endpoint');
    expect(result.point.x).toBeCloseTo(0);
    expect(result.point.y).toBeCloseTo(0);
  });

  test('cursor at (50,0) (wall midpoint, not an endpoint) with threshold=3 → none', () => {
    const result = snapToEndpoints({ x: 50, y: 0 }, [wall], 3);
    expect(result.type).toBe('none');
  });

  test('cursor at (99,0) within threshold=3 of end (100,0) → endpoint (100,0)', () => {
    const result = snapToEndpoints({ x: 99, y: 0 }, [wall], 3);
    expect(result.type).toBe('endpoint');
    expect(result.point.x).toBeCloseTo(100);
    expect(result.point.y).toBeCloseTo(0);
  });
});

describe('snapToMidpoints', () => {
  test('cursor at (51,0) within threshold=3 of midpoint (50,0) → midpoint (50,0)', () => {
    const result = snapToMidpoints({ x: 51, y: 0 }, [wall], 3);
    expect(result.type).toBe('midpoint');
    expect(result.point.x).toBeCloseTo(50);
    expect(result.point.y).toBeCloseTo(0);
  });

  test('cursor at (10,0) far from midpoint → none', () => {
    const result = snapToMidpoints({ x: 10, y: 0 }, [wall], 3);
    expect(result.type).toBe('none');
  });
});

describe('applySnapping', () => {
  test('endpointOnly settings, cursor near wall start → type=endpoint', () => {
    const result = applySnapping({ x: 1, y: 0 }, [wall], endpointOnly, viewport, ppcm, null, false);
    expect(result.type).toBe('endpoint');
  });

  test('gridOnly settings, no walls → type=grid, point snapped to grid', () => {
    const result = applySnapping({ x: 13, y: 7 }, [], gridOnly, viewport, ppcm, null, false);
    expect(result.type).toBe('grid');
    expect(result.point.x).toBeCloseTo(10);
    expect(result.point.y).toBeCloseTo(10);
  });

  test('allOff settings → type=none, point unchanged', () => {
    const cursor = { x: 13, y: 7 };
    const result = applySnapping(cursor, [wall], allOff, viewport, ppcm, null, false);
    expect(result.type).toBe('none');
    expect(result.point.x).toBeCloseTo(13);
    expect(result.point.y).toBeCloseTo(7);
  });

  test('endpoint takes priority over grid when both active, cursor near endpoint → type=endpoint', () => {
    const bothOn: UserSettings = { ...allOff, snapToEndpoint: true, snapToGrid: true };
    const result = applySnapping({ x: 1, y: 0 }, [wall], bothOn, viewport, ppcm, null, false);
    expect(result.type).toBe('endpoint');
  });

  test('threshold scales with zoom: at zoom=2, threshold=1.5; cursor 2cm from endpoint should NOT snap', () => {
    const highZoomViewport = { panX: 0, panY: 0, zoom: 2 };
    // threshold = 12 / (4 * 2) = 1.5; cursor is 2cm from endpoint, so should not snap
    const result = applySnapping({ x: 2, y: 0 }, [wall], endpointOnly, highZoomViewport, ppcm, null, false);
    expect(result.type).toBe('none');
  });
});
