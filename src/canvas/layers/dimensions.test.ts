/**
 * Tests for dimension line geometry helpers.
 * We test the perpendicular offset math directly without canvas rendering.
 */

/** Compute the perpendicular offset endpoints (Q1, Q2) for a dimension line. */
function dimensionOffsetPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  offset: number
): { q1: { x: number; y: number }; q2: { x: number; y: number } } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular: left of direction (counter-clockwise)
  const nx = -uy;
  const ny = ux;
  return {
    q1: { x: p1.x + nx * offset, y: p1.y + ny * offset },
    q2: { x: p2.x + nx * offset, y: p2.y + ny * offset },
  };
}

describe('dimension offset geometry', () => {
  test('horizontal wall (0,0)→(100,0), offset=12: Q1/Q2 offset below (canvas y-down)', () => {
    const { q1, q2 } = dimensionOffsetPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 12);
    // direction=(1,0), perp=(-uy,ux)=(0,1) → positive y (downward in canvas)
    expect(q1.x).toBeCloseTo(0);
    expect(q1.y).toBeCloseTo(12);
    expect(q2.x).toBeCloseTo(100);
    expect(q2.y).toBeCloseTo(12);
  });

  test('vertical wall (0,0)→(0,100), offset=12: Q1 to the left of P1', () => {
    const { q1, q2 } = dimensionOffsetPoints({ x: 0, y: 0 }, { x: 0, y: 100 }, 12);
    // direction=(0,1), perp=(-uy,ux)=(-1,0) → negative x (leftward)
    expect(q1.x).toBeCloseTo(-12);
    expect(q1.y).toBeCloseTo(0);
    expect(q2.x).toBeCloseTo(-12);
    expect(q2.y).toBeCloseTo(100);
  });

  test('dimension line length equals original segment length', () => {
    const { q1, q2 } = dimensionOffsetPoints({ x: 0, y: 0 }, { x: 60, y: 80 }, 20);
    const dimLen = Math.hypot(q2.x - q1.x, q2.y - q1.y);
    expect(dimLen).toBeCloseTo(100, 5); // hypot(60,80) = 100
  });

  test('negative offset places dimension line on opposite side', () => {
    const pos = dimensionOffsetPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 12);
    const neg = dimensionOffsetPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, -12);
    expect(neg.q1.y).toBeCloseTo(-pos.q1.y);
    expect(neg.q2.y).toBeCloseTo(-pos.q2.y);
  });
});
