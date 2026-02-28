import { describe, test, expect } from 'vitest';
import { computeExportBounds } from './export';
import type { Plan } from '../types/plan';

const emptyPlan: Plan = {
  id: 'p1', name: 'Test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  unit: 'cm', gridSize: 20,
  width: 500, height: 400,
  walls: [], rooms: [], furniture: [], openings: [],
  dimensions: [], textLabels: [],
  viewport: { panX: 0, panY: 0, zoom: 1 },
};

describe('computeExportBounds', () => {
  test('falls back to plan dims when no elements', () => {
    const b = computeExportBounds(emptyPlan);
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 500, maxY: 400 });
  });

  test('uses wall endpoints', () => {
    const plan: Plan = {
      ...emptyPlan,
      walls: [{
        id: 'w1', start: { x: 10, y: 20 }, end: { x: 200, y: 150 },
        thickness: 15, height: 244, color: '#2d2d2d', layer: 'exterior',
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(10);
    expect(b.minY).toBe(20);
    expect(b.maxX).toBe(200);
    expect(b.maxY).toBe(150);
  });

  test('includes furniture extents (position ± half-size)', () => {
    const plan: Plan = {
      ...emptyPlan,
      furniture: [{
        id: 'f1', templateId: 'sofa', label: 'Sofa',
        position: { x: 100, y: 100 }, width: 60, depth: 40,
        rotation: 0, color: '#a0a0a0', locked: false,
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(70);  // 100 - 30
    expect(b.maxX).toBe(130); // 100 + 30
    expect(b.minY).toBe(80);  // 100 - 20
    expect(b.maxY).toBe(120); // 100 + 20
  });

  test('includes dimension line endpoints', () => {
    const plan: Plan = {
      ...emptyPlan,
      dimensions: [{
        id: 'd1', start: { x: 5, y: 5 }, end: { x: 300, y: 200 }, offset: 12, overrideText: null,
      }],
    };
    const b = computeExportBounds(plan);
    expect(b.minX).toBe(5);
    expect(b.maxX).toBe(300);
  });
});
