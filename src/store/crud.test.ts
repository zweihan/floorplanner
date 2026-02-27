import { useStore } from './index';

const getActivePlan = () => {
  const { activePlanId, plans } = useStore.getState();
  return plans[activePlanId!];
};
const getState = () => useStore.getState();

beforeEach(() => {
  useStore.getState().newPlan('Test Plan');
});

describe('updateWall', () => {
  test('updateWall patches thickness without affecting other walls', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().addWall({ x: 0, y: 20 }, { x: 100, y: 20 });
    const [w1, w2] = getActivePlan().walls;
    getState().updateWall(w1.id, { thickness: 30 });
    expect(getActivePlan().walls.find(w => w.id === w1.id)!.thickness).toBe(30);
    expect(getActivePlan().walls.find(w => w.id === w2.id)!.thickness).toBe(w2.thickness);
  });

  test('updateWall creates a history entry (undo restores old thickness)', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    const originalThickness = getActivePlan().walls[0].thickness;
    getState().updateWall(wallId, { thickness: 30 });
    expect(getActivePlan().walls[0].thickness).toBe(30);
    getState().undo();
    expect(getActivePlan().walls[0].thickness).toBe(originalThickness);
  });

  test('updateWall can change layer', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().updateWall(wallId, { layer: 'exterior' });
    expect(getActivePlan().walls[0].layer).toBe('exterior');
  });

  test('updateWall can change color', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().updateWall(wallId, { color: '#ff0000' });
    expect(getActivePlan().walls[0].color).toBe('#ff0000');
  });
});

describe('updateDocument', () => {
  test('updateDocument changes plan name with history entry', () => {
    getState().updateDocument({ name: 'My Home' });
    expect(getActivePlan().name).toBe('My Home');
    getState().undo();
    expect(getActivePlan().name).toBe('Test Plan');
  });

  test('updateDocument changes gridSize', () => {
    getState().updateDocument({ gridSize: 20 });
    expect(getActivePlan().gridSize).toBe(20);
  });

  test('updateDocument changes unit', () => {
    getState().updateDocument({ unit: 'm' });
    expect(getActivePlan().unit).toBe('m');
  });
});

describe('opening cascade delete', () => {
  test('deleteElements([wallId]) also removes openings attached to that wall', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().addOpening({
      wallId,
      type: 'door',
      position: 0.5,
      width: 90,
      height: 210,
      sillHeight: 0,
      swingDirection: 'inward',
      openAngle: 90,
      flipSide: false,
    });
    expect(getActivePlan().openings).toHaveLength(1);
    getState().deleteElements([wallId]);
    expect(getActivePlan().walls).toHaveLength(0);
    expect(getActivePlan().openings).toHaveLength(0);
  });
});

describe('setWallLength', () => {
  test('moves end endpoint along direction; start is unchanged', () => {
    // Horizontal wall: start (0,0), end (100,0)
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().setWallLength(wallId, 200);
    const w = getActivePlan().walls[0];
    expect(w.start).toEqual({ x: 0, y: 0 });
    expect(w.end.x).toBeCloseTo(200);
    expect(w.end.y).toBeCloseTo(0);
  });

  test('preserves direction for diagonal wall', () => {
    // 45° wall: start (0,0), end (50,50) → length = 50√2 ≈ 70.71
    getState().addWall({ x: 0, y: 0 }, { x: 50, y: 50 });
    const wallId = getActivePlan().walls[0].id;
    const newLen = 100;
    getState().setWallLength(wallId, newLen);
    const w = getActivePlan().walls[0];
    expect(w.start).toEqual({ x: 0, y: 0 });
    // New end should be along 45° direction at distance 100
    expect(w.end.x).toBeCloseTo(newLen / Math.SQRT2);
    expect(w.end.y).toBeCloseTo(newLen / Math.SQRT2);
  });

  test('creates exactly one history entry (undo restores original)', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    const pastBefore = getState().past.length;
    getState().setWallLength(wallId, 200);
    expect(getState().past.length).toBe(pastBefore + 1);
    getState().undo();
    expect(getActivePlan().walls[0].end.x).toBeCloseTo(100);
  });

  test('connected wall endpoint follows when end moves', () => {
    // Wall A: (0,0)→(100,0). Wall B: (100,0)→(200,0) — shares the end of A
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().addWall({ x: 100, y: 0 }, { x: 200, y: 0 });
    const wallAId = getActivePlan().walls[0].id;
    // Shorten wall A to 50 cm
    getState().setWallLength(wallAId, 50);
    const walls = getActivePlan().walls;
    const wallA = walls.find(w => w.id === wallAId)!;
    const wallB = walls.find(w => w.id !== wallAId)!;
    // Wall A end moves to (50, 0)
    expect(wallA.end.x).toBeCloseTo(50);
    // Wall B start was joined to wall A end; it should follow to (50, 0)
    expect(wallB.start.x).toBeCloseTo(50);
    expect(wallB.start.y).toBeCloseTo(0);
  });

  test('no-op for degenerate wall (zero length)', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 0, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    // Should not throw and should not change anything
    expect(() => getState().setWallLength(wallId, 100)).not.toThrow();
  });
});
