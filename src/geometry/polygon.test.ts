import { shoelaceArea, polygonCentroid, pointInPolygon } from './polygon';

describe('shoelaceArea', () => {
  test('unit square (1×1) → area = 1', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(shoelaceArea(pts)).toBeCloseTo(1);
  });

  test('3-4-5 right triangle → area = 6', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }];
    expect(shoelaceArea(pts)).toBeCloseTo(6);
  });

  test('fewer than 3 points → 0', () => {
    expect(shoelaceArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  test('rectangle 10×20 → area = 200', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }];
    expect(shoelaceArea(pts)).toBeCloseTo(200);
  });
});

describe('polygonCentroid', () => {
  test('unit square centroid is (0.5, 0.5)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const c = polygonCentroid(pts);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
  });

  test('centroid of 100×60 rectangle is (50, 30)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }];
    const c = polygonCentroid(pts);
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(30);
  });
});

describe('pointInPolygon', () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

  test('point (50, 50) inside square → true', () => {
    expect(pointInPolygon(square, { x: 50, y: 50 })).toBe(true);
  });

  test('point (150, 50) outside square → false', () => {
    expect(pointInPolygon(square, { x: 150, y: 50 })).toBe(false);
  });

  test('point (-1, 50) outside square → false', () => {
    expect(pointInPolygon(square, { x: -1, y: 50 })).toBe(false);
  });

  test('point at corner (0, 0) — does not throw', () => {
    expect(() => pointInPolygon(square, { x: 0, y: 0 })).not.toThrow();
  });
});
