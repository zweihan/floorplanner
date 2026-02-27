import type { DisplayUnit } from '../types/plan';

export function cmToUnit(cm: number, unit: DisplayUnit): number {
  if (unit === 'm') return cm / 100;
  if (unit === 'ft') return cm / 30.48; // decimal feet
  return cm;
}

export function unitToCm(value: number, unit: DisplayUnit): number {
  if (unit === 'm') return value * 100;
  if (unit === 'ft') return value * 30.48;
  return value;
}

export function formatMeasurement(cm: number, unit: DisplayUnit): string {
  if (unit === 'm') return `${(cm / 100).toFixed(2)} m`;
  if (unit === 'ft') {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return inches === 12 ? `${feet + 1}' 0"` : `${feet}' ${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

/** Parses imperial string "12' 6\"" or decimal feet "12.5" → cm. */
export function parseImperialInput(input: string): number | null {
  const ftIn = input.match(/^(\d+)'\s*(\d+)"?$/);
  if (ftIn) return (parseInt(ftIn[1]) * 12 + parseInt(ftIn[2])) * 2.54;
  const dec = parseFloat(input);
  if (!isNaN(dec)) return dec * 30.48;
  return null;
}
