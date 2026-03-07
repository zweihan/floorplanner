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
  { id: 'toilet',     label: 'Toilet',     category: 'Bathroom', defaultWidth:  38, defaultDepth:  60, defaultColor: '#e0e8f0' },
  { id: 'bathtub',   label: 'Bathtub',   category: 'Bathroom', defaultWidth:  75, defaultDepth: 160, defaultColor: '#e0e8f0' },
  { id: 'sink',      label: 'Sink',      category: 'Bathroom', defaultWidth:  50, defaultDepth:  45, defaultColor: '#e0e8f0' },
  { id: 'shower',    label: 'Shower',    category: 'Bathroom', defaultWidth:  90, defaultDepth:  90, defaultColor: '#d8edf8' },
  { id: 'showerhead', label: 'Showerhead', category: 'Bathroom', defaultWidth: 30, defaultDepth:  30, defaultColor: '#c0d4e8' },
  { id: 'cabinet', label: 'Cabinet', category: 'Storage',  defaultWidth:  90, defaultDepth:  60, defaultColor: '#c8bfae' },
  // Electrical
  { id: 'lamp',    label: 'Lamp',    category: 'Electrical', defaultWidth: 30,  defaultDepth:  30, defaultColor: '#fff9c4' },
  { id: 'outlet',  label: 'Outlet',  category: 'Electrical', defaultWidth: 10,  defaultDepth:  10, defaultColor: '#e0e0e0' },
  { id: 'switch',  label: 'Switch',  category: 'Electrical', defaultWidth: 10,  defaultDepth:  10, defaultColor: '#e0e0e0' },
  // Plumbing
  { id: 'pipe-supply', label: 'Supply Pipe', category: 'Plumbing', defaultWidth: 100, defaultDepth:  6, defaultColor: '#b3d9f5' },
  { id: 'pipe-drain',  label: 'Drain Pipe',  category: 'Plumbing', defaultWidth: 100, defaultDepth:  8, defaultColor: '#c8bfa8' },
  { id: 'valve',       label: 'Valve',       category: 'Plumbing', defaultWidth:  15, defaultDepth: 15, defaultColor: '#f5c6c6' },
  // HVAC
  { id: 'ac-indoor', label: 'AC Indoor Unit',   category: 'HVAC', defaultWidth:  80, defaultDepth: 20, defaultColor: '#d0eaf5' },
  { id: 'ac-duct',   label: 'Coolant Duct',     category: 'HVAC', defaultWidth: 100, defaultDepth:  8, defaultColor: '#d5e8d4' },
  { id: 'ac-drain',  label: 'Condensate Drain', category: 'HVAC', defaultWidth: 100, defaultDepth:  6, defaultColor: '#dae8fc' },
];

export function getTemplate(id: string): FurnitureTemplate | undefined {
  return FURNITURE_TEMPLATES.find(t => t.id === id);
}
