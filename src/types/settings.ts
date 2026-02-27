export interface UserSettings {
  displayUnit: 'cm' | 'm' | 'ft';
  defaultWallThickness: number; // cm; default 15
  defaultGridSize: number;      // cm; default 10
  snapToGrid: boolean;
  snapToEndpoint: boolean;
  snapToMidpoint: boolean;
  snapToAngle: boolean;
  showDimensions: boolean;
  theme: 'light' | 'dark';
}
