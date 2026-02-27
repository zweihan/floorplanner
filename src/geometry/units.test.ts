import { formatMeasurement, parseImperialInput } from './units';

describe('formatMeasurement cm', () => {
  test('300 cm → "300 cm"', () => {
    expect(formatMeasurement(300, 'cm')).toBe('300 cm');
  });

  test('150 cm → "150 cm"', () => {
    expect(formatMeasurement(150, 'cm')).toBe('150 cm');
  });
});

describe('formatMeasurement m', () => {
  test('300 cm → "3.00 m"', () => {
    expect(formatMeasurement(300, 'm')).toBe('3.00 m');
  });

  test('50 cm → "0.50 m"', () => {
    expect(formatMeasurement(50, 'm')).toBe('0.50 m');
  });
});

describe('formatMeasurement ft', () => {
  test('300 cm → "9\' 10\""', () => {
    // 300 / 2.54 = 118.11 inches → 9 ft, 10.11 in → round(10.11) = 10
    expect(formatMeasurement(300, 'ft')).toBe("9' 10\"");
  });

  test('30.48 cm → "1\' 0\"" (exactly 12 inches = 1 foot)', () => {
    // 30.48 / 2.54 = 12 inches exactly → inches===12 → 1 ft 0 in
    expect(formatMeasurement(30.48, 'ft')).toBe("1' 0\"");
  });

  test('360 cm → "11\' 10\""', () => {
    // 360 / 2.54 = 141.732... inches → floor(141.732/12)=11, 141.732%12=9.732, round(9.732)=10
    expect(formatMeasurement(360, 'ft')).toBe("11' 10\"");
  });
});

describe('parseImperialInput', () => {
  test('"12\' 6\"" → ~381 cm', () => {
    // (12*12 + 6) * 2.54 = 150 * 2.54 = 381
    expect(parseImperialInput("12' 6\"")).toBeCloseTo(381, 5);
  });

  test('"0\' 6\"" → ~15.24 cm', () => {
    // (0*12 + 6) * 2.54 = 6 * 2.54 = 15.24
    expect(parseImperialInput("0' 6\"")).toBeCloseTo(15.24, 5);
  });

  test('"12.5" → ~381 cm', () => {
    // 12.5 * 30.48 = 381
    expect(parseImperialInput('12.5')).toBeCloseTo(381, 5);
  });

  test('"abc" → null', () => {
    expect(parseImperialInput('abc')).toBeNull();
  });
});
