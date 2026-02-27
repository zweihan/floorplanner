import { segmentLength, segmentAngle, nearestPointOnSegment, pointToSegmentDist } from './segment';

describe('segmentLength', () => {
  test('(0,0) to (3,4) = 5', () => {
    expect(segmentLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  test('zero-length segment = 0', () => {
    expect(segmentLength({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('segmentAngle', () => {
  test('horizontal right segment has angle 0', () => {
    expect(segmentAngle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  test('vertical down segment has angle PI/2', () => {
    expect(segmentAngle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
  });
});

describe('nearestPointOnSegment', () => {
  test('point directly above midpoint → midpoint', () => {
    const result = nearestPointOnSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(0);
  });

  test('point past end → clamped to end', () => {
    const result = nearestPointOnSegment({ x: 150, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  test('point before start → clamped to start', () => {
    const result = nearestPointOnSegment({ x: -50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });
});

describe('pointToSegmentDist', () => {
  test('point directly above midpoint → perpendicular distance', () => {
    const dist = pointToSegmentDist({ x: 50, y: 15 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dist).toBeCloseTo(15);
  });

  test('point at endpoint → 0', () => {
    const dist = pointToSegmentDist({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dist).toBeCloseTo(0);
  });

  test('point beyond end → distance to endpoint', () => {
    const dist = pointToSegmentDist({ x: 103, y: 4 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dist).toBeCloseTo(5);
  });
});
