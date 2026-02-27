export interface FurnitureTemplate {
  id: string;
  label: string;
  defaultWidth: number;  // cm
  defaultDepth: number;  // cm
  defaultColor: string;
}

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  { id: 'sofa',    label: 'Sofa',    defaultWidth: 200, defaultDepth:  80, defaultColor: '#c8b89a' },
  { id: 'bed',     label: 'Bed',     defaultWidth: 160, defaultDepth: 200, defaultColor: '#c8b8d4' },
  { id: 'table',   label: 'Table',   defaultWidth: 120, defaultDepth:  80, defaultColor: '#b4a88a' },
  { id: 'chair',   label: 'Chair',   defaultWidth:  50, defaultDepth:  50, defaultColor: '#aac8b0' },
  { id: 'desk',    label: 'Desk',    defaultWidth: 140, defaultDepth:  70, defaultColor: '#b4a88a' },
  { id: 'toilet',  label: 'Toilet',  defaultWidth:  38, defaultDepth:  60, defaultColor: '#e0e8f0' },
  { id: 'bathtub', label: 'Bathtub', defaultWidth:  75, defaultDepth: 160, defaultColor: '#e0e8f0' },
  { id: 'sink',    label: 'Sink',    defaultWidth:  50, defaultDepth:  45, defaultColor: '#e0e8f0' },
  { id: 'stove',   label: 'Stove',   defaultWidth:  60, defaultDepth:  60, defaultColor: '#d0d0d0' },
  { id: 'fridge',  label: 'Fridge',  defaultWidth:  60, defaultDepth:  65, defaultColor: '#d8e8f0' },
];

export function getTemplate(id: string): FurnitureTemplate | undefined {
  return FURNITURE_TEMPLATES.find(t => t.id === id);
}
