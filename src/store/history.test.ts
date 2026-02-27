import { useStore } from './index';

const getActivePlan = () => {
  const { activePlanId, plans } = useStore.getState();
  return plans[activePlanId!];
};

const getState = () => useStore.getState();

beforeEach(() => {
  useStore.getState().newPlan('Test Plan');
});

describe('initial state', () => {
  test('active plan has 0 walls initially', () => {
    expect(getActivePlan().walls).toHaveLength(0);
  });
});

describe('addWall', () => {
  test('addWall adds a wall with correct start/end', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const walls = getActivePlan().walls;
    expect(walls).toHaveLength(1);
    expect(walls[0].start).toEqual({ x: 0, y: 0 });
    expect(walls[0].end).toEqual({ x: 100, y: 0 });
  });

  test('addWall twice then undo → 1 wall', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().addWall({ x: 0, y: 10 }, { x: 100, y: 10 });
    getState().undo();
    expect(getActivePlan().walls).toHaveLength(1);
  });

  test('addWall twice then undo undo → 0 walls', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().addWall({ x: 0, y: 10 }, { x: 100, y: 10 });
    getState().undo();
    getState().undo();
    expect(getActivePlan().walls).toHaveLength(0);
  });

  test('addWall then undo then redo → 1 wall again', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().undo();
    getState().redo();
    expect(getActivePlan().walls).toHaveLength(1);
  });
});

describe('undo/redo edge cases', () => {
  test('undo on empty history is no-op (no throw, 0 walls)', () => {
    expect(() => getState().undo()).not.toThrow();
    expect(getActivePlan().walls).toHaveLength(0);
  });

  test('redo on empty future is no-op (no throw)', () => {
    expect(() => getState().redo()).not.toThrow();
  });

  test('addWall then undo then addWall again → future is cleared (redo has nothing)', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().undo();
    getState().addWall({ x: 0, y: 20 }, { x: 100, y: 20 });
    getState().redo(); // should be no-op since future was cleared
    expect(getActivePlan().walls).toHaveLength(1);
  });
});

describe('setCamera', () => {
  test('setCamera does NOT create a history entry (past remains empty)', () => {
    getState().setCamera({ panX: 100, panY: 200, zoom: 2 });
    expect(getState().past).toHaveLength(0);
  });
});

describe('deleteElements', () => {
  test('deleteElements removes wall from plan', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().deleteElements([wallId]);
    expect(getActivePlan().walls).toHaveLength(0);
  });
});

describe('moveElements', () => {
  test('moveElements translates wall endpoints', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    const wallId = getActivePlan().walls[0].id;
    getState().moveElements([wallId], 10, 5);
    const moved = getActivePlan().walls[0];
    expect(moved.start.x).toBeCloseTo(10);
    expect(moved.start.y).toBeCloseTo(5);
    expect(moved.end.x).toBeCloseTo(110);
    expect(moved.end.y).toBeCloseTo(5);
  });
});

describe('setActivePlanNoHistory', () => {
  test('setActivePlanNoHistory does NOT push to past', () => {
    expect(getState().past).toHaveLength(0);
    const plan = getActivePlan();
    // Modify the plan directly without going through history
    getState().setActivePlanNoHistory({ ...plan, name: 'Modified' });
    // past should still be empty — no history entry was created
    expect(getState().past).toHaveLength(0);
    // But the change was applied
    expect(getActivePlan().name).toBe('Modified');
  });
});

describe('past stack management', () => {
  test('after undo, past decreases by 1', () => {
    getState().addWall({ x: 0, y: 0 }, { x: 100, y: 0 });
    getState().addWall({ x: 0, y: 10 }, { x: 100, y: 10 });
    const pastLengthBefore = getState().past.length;
    getState().undo();
    expect(getState().past.length).toBe(pastLengthBefore - 1);
  });

  test('withHistory caps past at 100 after 101 addWall calls', () => {
    for (let i = 0; i < 101; i++) {
      getState().addWall({ x: i, y: 0 }, { x: i + 10, y: 0 });
    }
    expect(getState().past.length).toBe(100);
  });
});
