import {
  hitTestWall,
  hitTestWallForOpening,
  hitTestWallEndpoint,
  hitTestWallMidpoint,
  hitTestRoom,
  hitTestFurniture,
  hitTestPlan,
  hitTestPlanInRect,
  wallBBox,
  type BBox,
} from './hitTest';
import type { Wall, Room, FurnitureItem, TextLabel, Plan } from '../types/plan';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const wall: Wall = {
  id: 'w1',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  thickness: 15,
  height: 244,
  color: '#2d2d2d',
  layer: 'interior',
};

const room: Room = {
  id: 'r1',
  name: 'Room',
  wallIds: [],
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  color: '#e0e0e0',
  area: 0,
  labelPosition: { x: 50, y: 50 },
  showArea: false,
  showLabel: true,
};

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'p1',
    name: 'Test',
    createdAt: '',
    updatedAt: '',
    unit: 'cm',
    gridSize: 10,
    width: 1200,
    height: 800,
    walls: [],
    rooms: [],
    openings: [],
    furniture: [],
    dimensions: [],
    textLabels: [],
    viewport: { panX: 0, panY: 0, zoom: 1 },
    ...overrides,
  };
}

// ─── hitTestWallForOpening ────────────────────────────────────────────────────

describe('hitTestWallForOpening', () => {
  test('returns t ≈ 0.5 when point is at midpoint of wall centreline', () => {
    const t = hitTestWallForOpening(wall, { x: 50, y: 0 }, 5);
    expect(t).not.toBeNull();
    expect(t).toBeCloseTo(0.5);
  });

  test('returns correct t for off-centre point near centreline', () => {
    // (25, 3) on wall (0,0)→(100,0): projection = 25 cm along wall, dist=3 <= threshold=5
    const t = hitTestWallForOpening(wall, { x: 25, y: 3 }, 5);
    expect(t).not.toBeNull();
    expect(t).toBeCloseTo(0.25);
  });

  test('returns null when point is beyond perpendicular threshold', () => {
    // (50, 10): projects to (50,0), perpDist=10 > threshold=5
    expect(hitTestWallForOpening(wall, { x: 50, y: 10 }, 5)).toBeNull();
  });

  test('returns null when projection falls outside wall bounds (t < 0)', () => {
    expect(hitTestWallForOpening(wall, { x: -5, y: 0 }, 5)).toBeNull();
  });

  test('returns null when projection falls outside wall bounds (t > 1)', () => {
    expect(hitTestWallForOpening(wall, { x: 105, y: 0 }, 5)).toBeNull();
  });
});

// ─── hitTestWall ─────────────────────────────────────────────────────────────

describe('hitTestWall', () => {
  test('point at (50,5) on wall body → true (dist=5 <= thickness/2=7.5)', () => {
    expect(hitTestWall(wall, { x: 50, y: 5 }, 0)).toBe(true);
  });

  test('point at (50,8) just outside wall body, threshold=0 → false (dist=8 > 7.5)', () => {
    expect(hitTestWall(wall, { x: 50, y: 8 }, 0)).toBe(false);
  });

  test('point at (50,8) with threshold=2 → true (dist=8 <= 7.5+2=9.5)', () => {
    expect(hitTestWall(wall, { x: 50, y: 8 }, 2)).toBe(true);
  });

  test('point far off wall (50,50), threshold=5 → false', () => {
    expect(hitTestWall(wall, { x: 50, y: 50 }, 5)).toBe(false);
  });
});

// ─── hitTestWallEndpoint ─────────────────────────────────────────────────────

describe('hitTestWallEndpoint', () => {
  test('point at (1,0), threshold=2 → "start"', () => {
    expect(hitTestWallEndpoint(wall, { x: 1, y: 0 }, 2)).toBe('start');
  });

  test('point at (99,0), threshold=2 → "end"', () => {
    expect(hitTestWallEndpoint(wall, { x: 99, y: 0 }, 2)).toBe('end');
  });

  test('point at (50,0), threshold=2 → null', () => {
    expect(hitTestWallEndpoint(wall, { x: 50, y: 0 }, 2)).toBeNull();
  });
});

// ─── hitTestWallMidpoint ─────────────────────────────────────────────────────

describe('hitTestWallMidpoint', () => {
  test('point at (50,1), threshold=2 → true (midpoint=(50,0), dist=1<=2)', () => {
    expect(hitTestWallMidpoint(wall, { x: 50, y: 1 }, 2)).toBe(true);
  });

  test('point at (50,5), threshold=2 → false (dist=5>2)', () => {
    expect(hitTestWallMidpoint(wall, { x: 50, y: 5 }, 2)).toBe(false);
  });
});

// ─── hitTestRoom ─────────────────────────────────────────────────────────────

describe('hitTestRoom', () => {
  test('point inside room (50,50) → true', () => {
    expect(hitTestRoom(room, { x: 50, y: 50 })).toBe(true);
  });

  test('point outside room (150,50) → false', () => {
    expect(hitTestRoom(room, { x: 150, y: 50 })).toBe(false);
  });

  test('point on border → does not throw', () => {
    expect(() => hitTestRoom(room, { x: 0, y: 0 })).not.toThrow();
  });
});

// ─── hitTestFurniture ────────────────────────────────────────────────────────

describe('hitTestFurniture (unrotated)', () => {
  const f: FurnitureItem = {
    id: 'f1', templateId: 'table', label: 'Table',
    position: { x: 50, y: 50 },
    width: 40, depth: 30, rotation: 0,
    color: '#a0a0a0', locked: false,
  };

  test('point at (60,55) inside → true (|10|<=20 && |5|<=15)', () => {
    expect(hitTestFurniture(f, { x: 60, y: 55 })).toBe(true);
  });

  test('point at (75,50) outside → false (|25|>20)', () => {
    expect(hitTestFurniture(f, { x: 75, y: 50 })).toBe(false);
  });
});

describe('hitTestFurniture (rotated 45°)', () => {
  // 40×30 item at (50,50) rotated 45°
  // hw=20, hd=15
  // A point along the local x-axis (width) at distance 15 in local: world ≈ (50+15/√2, 50+15/√2) ≈ (60.6, 60.6)
  const f45: FurnitureItem = {
    id: 'f2', templateId: 'table', label: 'Table',
    position: { x: 50, y: 50 },
    width: 40, depth: 30, rotation: 45,
    color: '#a0a0a0', locked: false,
  };

  test('point near center still inside → true', () => {
    expect(hitTestFurniture(f45, { x: 51, y: 51 })).toBe(true);
  });

  test('point along unrotated axis but outside rotated bbox → false', () => {
    // (75, 50): in unrotated version would be inside (|25|>20 → false), in rotated version also outside
    expect(hitTestFurniture(f45, { x: 75, y: 50 })).toBe(false);
  });

  test('point along rotated local x-axis within bounds → true', () => {
    // local x=15 at 45°: world ≈ (50+15*cos45, 50+15*sin45) ≈ (60.6, 60.6)
    const d = 15 / Math.SQRT2;
    expect(hitTestFurniture(f45, { x: 50 + d, y: 50 + d })).toBe(true);
  });
});

// ─── wallBBox ────────────────────────────────────────────────────────────────

describe('wallBBox', () => {
  test('wall from (0,0) to (100,0) thickness=15 has correct bbox', () => {
    const bbox = wallBBox(wall);
    expect(bbox.minX).toBeCloseTo(-7.5);
    expect(bbox.maxX).toBeCloseTo(107.5);
    expect(bbox.minY).toBeCloseTo(-7.5);
    expect(bbox.maxY).toBeCloseTo(7.5);
  });
});

// ─── hitTestPlan ─────────────────────────────────────────────────────────────

describe('hitTestPlan', () => {
  test('text label at cursor position is returned before wall (topmost layer first)', () => {
    const textLabel: TextLabel = {
      id: 'lbl1',
      position: { x: 50, y: 0 },
      text: 'A',
      fontSize: 14,
      color: '#333',
      align: 'center',
    };
    const plan = makePlan({ walls: [wall], textLabels: [textLabel] });
    // Point (50,0): label hitTest passes (|0|<=4.9, |0|<=8.4); wall also hits (dist=0)
    // Text label (topmost) should be returned
    const result = hitTestPlan(plan, { x: 50, y: 0 }, 0);
    expect(result).toBe('lbl1');
  });

  test('returns null when nothing is hit', () => {
    const plan = makePlan();
    expect(hitTestPlan(plan, { x: 500, y: 500 }, 0)).toBeNull();
  });
});

// ─── hitTestPlanInRect ───────────────────────────────────────────────────────

describe('hitTestPlanInRect', () => {
  test('rect covers wall1 but not wall2 → only wall1 id returned', () => {
    const wall2: Wall = {
      id: 'w2',
      start: { x: 200, y: 0 }, end: { x: 300, y: 0 },
      thickness: 15, height: 244, color: '#2d2d2d', layer: 'interior',
    };
    const plan = makePlan({ walls: [wall, wall2] });
    const rect: BBox = { minX: 0, minY: -10, maxX: 150, maxY: 10 };
    const ids = hitTestPlanInRect(plan, rect);
    expect(ids).toContain('w1');
    expect(ids).not.toContain('w2');
  });
});
