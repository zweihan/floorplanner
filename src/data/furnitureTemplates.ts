export interface FurnitureTemplate {
  id: string;
  label: string;
  category: string;
  defaultWidth: number;  // cm
  defaultDepth: number;  // cm
  defaultColor: string;
}

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  { id: 'sofa',    label: 'Sofa',    category: 'Living',   defaultWidth: 200, defaultDepth:  80, defaultColor: '#c8b89a' },
  { id: 'table',   label: 'Table',   category: 'Living',   defaultWidth: 120, defaultDepth:  80, defaultColor: '#b4a88a' },
  { id: 'chair',   label: 'Chair',   category: 'Living',   defaultWidth:  50, defaultDepth:  50, defaultColor: '#aac8b0' },
  { id: 'bed',     label: 'Bed',     category: 'Bedroom',  defaultWidth: 160, defaultDepth: 200, defaultColor: '#c8b8d4' },
  { id: 'desk',    label: 'Desk',    category: 'Bedroom',  defaultWidth: 140, defaultDepth:  70, defaultColor: '#b4a88a' },
  { id: 'stove',   label: 'Stove',   category: 'Kitchen',  defaultWidth:  60, defaultDepth:  60, defaultColor: '#d0d0d0' },
  { id: 'fridge',  label: 'Fridge',  category: 'Kitchen',  defaultWidth:  60, defaultDepth:  65, defaultColor: '#d8e8f0' },
  { id: 'toilet',  label: 'Toilet',  category: 'Bathroom', defaultWidth:  38, defaultDepth:  60, defaultColor: '#e0e8f0' },
  { id: 'bathtub', label: 'Bathtub', category: 'Bathroom', defaultWidth:  75, defaultDepth: 160, defaultColor: '#e0e8f0' },
  { id: 'sink',    label: 'Sink',    category: 'Bathroom', defaultWidth:  50, defaultDepth:  45, defaultColor: '#e0e8f0' },
  { id: 'cabinet', label: 'Cabinet', category: 'Storage',  defaultWidth:  90, defaultDepth:  60, defaultColor: '#c8bfae' },
];

export function getTemplate(id: string): FurnitureTemplate | undefined {
  return FURNITURE_TEMPLATES.find(t => t.id === id);
}
