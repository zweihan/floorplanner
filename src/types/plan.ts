// All geometry values are in centimeters unless noted otherwise.

export interface Point {
  x: number;
  y: number;
}

export type DisplayUnit = 'cm' | 'm' | 'ft';

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;   // cm; default 15
  height: number;      // cm; default 244 (8')
  color: string;       // default "#2d2d2d"
  layer: 'exterior' | 'interior'; // architectural type only; all walls are on "structure" canvas layer
}

export interface Room {
  id: string;
  name: string;
  wallIds: string[];       // optional; used for rooms created by wall-chain closing
  points: Point[];         // authoritative polygon vertices
  color: string;           // hex with alpha applied at render time
  area: number;            // computed cm²; not persisted
  labelPosition: Point;    // default: centroid
  showArea: boolean;
  showLabel: boolean;
}

export interface Opening {
  id: string;
  wallId: string;
  type: 'door' | 'window' | 'sliding-door' | 'double-door' | 'bay-window';
  position: number;        // 0.0–1.0 parametric along parent wall
  width: number;           // cm
  height: number;          // cm
  sillHeight: number;      // cm from floor (windows only)
  swingDirection: 'left' | 'right' | 'inward' | 'outward';
  openAngle: number;       // degrees; default 90
  flipSide: boolean;
}

export interface FurnitureItem {
  id: string;
  templateId: string;
  label: string;
  position: Point;         // center in world space, cm
  width: number;           // cm
  depth: number;           // cm
  rotation: number;        // degrees clockwise
  color: string;           // default "#a0a0a0"
  locked: boolean;
}

export interface DimensionLine {
  id: string;
  start: Point;            // cm
  end: Point;              // cm
  offset: number;          // perpendicular offset in cm
  overrideText: string | null;
  startWallId?: string;
  startWallEnd?: 'start' | 'end';
  endWallId?: string;
  endWallEnd?: 'start' | 'end';
}

export interface TextLabel {
  id: string;
  position: Point;         // cm
  text: string;
  fontSize: number;        // world units (cm); scales with zoom
  color: string;           // default "#333333"
  align: 'left' | 'center' | 'right';
}

export interface Viewport {
  panX: number;            // pixels
  panY: number;
  zoom: number;            // ppcm multiplier; 1.0 = 4px/cm
}

export interface Plan {
  id: string;
  name: string;
  createdAt: string;       // ISO 8601
  updatedAt: string;
  unit: 'cm' | 'm' | 'ft' | 'in';
  gridSize: number;        // cm
  width: number;           // cm; default 1200
  height: number;          // cm; default 800
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
  furniture: FurnitureItem[];
  dimensions: DimensionLine[];
  textLabels: TextLabel[];
  viewport: Viewport;
}
