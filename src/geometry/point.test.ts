import { distance, midpoint, lerp, normalize, dot, perpendicular } from './point';

describe('distance', () => {
  test('horizontal distance 300', () => {
    expect(distance({ x: 0, y: 0 }, { x: 300, y: 0 })).toBe(300);
  });

  test('zero distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  test('3-4-5 triangle gives 5', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('midpoint', () => {
  test('midpoint of (0,0) and (100,60) is (50,30)', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual({ x: 50, y: 30 });
  });
});

describe('lerp', () => {
  test('t=0 returns start', () => {
    expect(lerp({ x: 10, y: 20 }, { x: 100, y: 200 }, 0)).toEqual({ x: 10, y: 20 });
  });

  test('t=1 returns end', () => {
    expect(lerp({ x: 10, y: 20 }, { x: 100, y: 200 }, 1)).toEqual({ x: 100, y: 200 });
  });

  test('t=0.5 returns midpoint', () => {
    expect(lerp({ x: 0, y: 0 }, { x: 100, y: 60 }, 0.5)).toEqual({ x: 50, y: 30 });
  });
});

describe('normalize', () => {
  test('normalize (3,4) = (0.6, 0.8)', () => {
    const result = normalize({ x: 3, y: 4 });
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  test('normalize zero vector returns (0,0)', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('dot', () => {
  test('dot of orthogonal vectors is 0', () => {
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
  });

  test('dot((2,3),(4,5)) = 23', () => {
    expect(dot({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
  });
});

describe('perpendicular', () => {
  test('perpendicular(1,0) = (0,1)', () => {
    const r = perpendicular({ x: 1, y: 0 });
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });

  test('perpendicular(0,1) = (-1,0)', () => {
    const r = perpendicular({ x: 0, y: 1 });
    expect(r.x).toBeCloseTo(-1);
    expect(r.y).toBeCloseTo(0);
  });
});
