import type { UserSettings } from '../types/settings';

export const DEFAULT_SETTINGS: UserSettings = {
  displayUnit: 'cm',
  defaultWallThickness: 15,
  defaultGridSize: 10,
  snapToGrid: false,
  snapToEndpoint: true,
  snapToMidpoint: false,
  snapToAngle: true,
  showDimensions: true,
  theme: 'light',
};
