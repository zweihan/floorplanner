import { create } from 'zustand';
import type { Plan, Point, Wall, Room, Opening, FurnitureItem, DimensionLine, TextLabel, Viewport, BackgroundImage } from '../types/plan';
import type { ToolType, LayerName, DrawingState, Toast } from '../types/tools';
import type { UserSettings } from '../types/settings';
import { uuid } from '../utils/uuid';
import { DEFAULT_SETTINGS } from '../data/defaultSettings';
import { STORAGE_KEYS, saveToStorage, loadFromStorage } from '../utils/localStorage';

// ─── Default plan ────────────────────────────────────────────────────────────

function makeDefaultPlan(): Plan {
  return {
    id: uuid(),
    name: 'Untitled Plan',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unit: 'cm',
    gridSize: 10,
    width: 1200,
    height: 800,
    walls: [],
    rooms: [],
    openings: [],
    furniture: [],
    dimensions: [],
    textLabels: [],
    viewport: { panX: 0, panY: 0, zoom: 1.0 },
  };
}

// ─── History helper ───────────────────────────────────────────────────────────

type SetFn = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
type GetFn = () => AppState;

function withHistory(set: SetFn, get: GetFn, mutation: (plan: Plan) => Plan): void {
  const state = get();
  const { activePlanId, plans, past } = state;
  if (!activePlanId) return;
  const current = plans[activePlanId];
  const next = mutation(structuredClone(current));
  next.updatedAt = new Date().toISOString();
  set({
    plans: { ...plans, [activePlanId]: next },
    past: [...past, current].slice(-100),
    future: [],
  });
}

// ─── Default layer state ──────────────────────────────────────────────────────

const DEFAULT_LAYERS: Record<LayerName, { visible: boolean; locked: boolean }> = {
  structure: { visible: true, locked: false },
  furniture: { visible: true, locked: false },
  annotations: { visible: true, locked: false },
};

// ─── Store interface ──────────────────────────────────────────────────────────

interface AppState {
  // Plan data
  activePlanId: string | null;
  plans: Record<string, Plan>;

  // Editor state
  selectedIds: string[];
  hoveredId: string | null;
  activeTool: ToolType;
  drawingState: DrawingState | null;
  wallChain: Point[];
  ghostPoint: Point | null;

  // Settings
  settings: UserSettings;

  // UI state
  showGrid: boolean;
  layers: Record<LayerName, { visible: boolean; locked: boolean }>;
  pendingFurnitureTemplateId: string | null;
  toasts: Toast[];

  // Background reference images (keyed by planId; not part of undo history)
  backgroundImages: Record<string, BackgroundImage>;
  calibrationLine: { start: Point; end: Point } | null;

  // History
  past: Plan[];
  future: Plan[];

  // ─── Actions ───────────────────────────────────────────────────────────────
  addWall(start: Point, end: Point): void;
  updateWall(id: string, changes: Partial<Wall>): void;
  /** Set wall length by moving end endpoint along current direction; auto-updates joined walls. */
  setWallLength(id: string, newLengthCm: number): void;
  deleteWall(id: string): void;

  addOpening(opening: Omit<Opening, 'id'>): void;
  updateOpening(id: string, changes: Partial<Opening>): void;
  deleteOpening(id: string): void;

  addRoom(room: Omit<Room, 'id'>): void;
  updateRoom(id: string, changes: Partial<Room>): void;
  deleteRoom(id: string): void;

  addFurniture(item: Omit<FurnitureItem, 'id'>): void;
  updateFurniture(id: string, changes: Partial<FurnitureItem>): void;
  deleteFurniture(id: string): void;

  addDimension(dim: Omit<DimensionLine, 'id'>): void;
  updateDimension(id: string, changes: Partial<DimensionLine>): void;
  deleteDimension(id: string): void;

  addTextLabel(label: Omit<TextLabel, 'id'>): void;
  updateTextLabel(id: string, changes: Partial<TextLabel>): void;
  deleteTextLabel(id: string): void;

  deleteElements(ids: string[]): void;
  moveElements(ids: string[], dx: number, dy: number): void;
  /** Replace active plan without recording a history entry (used for live drag preview). */
  setActivePlanNoHistory(plan: Plan): void;
  /** Update multiple wall endpoints in a single history step (used for joined-wall endpoint drag). */
  updateWallEndpoints(updates: Array<{ id: string; endpoint: 'start' | 'end'; position: Point }>): void;

  setSelectedIds(ids: string[]): void;
  setHoveredId(id: string | null): void;
  setActiveTool(tool: ToolType): void;
  setPendingFurnitureTemplate(templateId: string | null): void;
  setDrawingState(state: DrawingState | null): void;
  setGhostPoint(p: Point | null): void;
  pushToChain(p: Point): void;
  clearChain(): void;
  setCamera(changes: Partial<Viewport>): void;
  setLayer(name: LayerName, changes: { visible?: boolean; locked?: boolean }): void;

  undo(): void;
  redo(): void;

  loadPlan(plan: Plan): void;
  newPlan(name: string): void;
  deletePlan(id: string): void;
  switchPlan(id: string): void;

  updateSettings(changes: Partial<UserSettings>): void;
  updateDocument(changes: Partial<Pick<Plan, 'name' | 'unit' | 'gridSize' | 'width' | 'height'>>): void;

  addToast(message: string, type?: Toast['type'], durationMs?: number): void;
  dismissToast(id: string): void;

  setBackgroundImage(planId: string, bg: BackgroundImage | null): void;
  updateBackgroundImage(planId: string, patch: Partial<BackgroundImage>): void;
  setCalibrationLine(line: { start: Point; end: Point } | null): void;

  toggleShowGrid(): void;
  toggleSnapToGrid(): void;
  forceSave(): void;
  selectAll(): void;
  zoomIn(): void;
  zoomOut(): void;
  fitToScreen(canvasWidth: number, canvasHeight: number): void;
}

// ─── Load persisted state ─────────────────────────────────────────────────────

const defaultPlan = makeDefaultPlan();
const persistedPlans = loadFromStorage<Record<string, Plan>>(STORAGE_KEYS.plans, {});
const persistedActivePlanId = loadFromStorage<string | null>(STORAGE_KEYS.activePlanId, null);
const persistedSettings = loadFromStorage<UserSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

const initialPlans = Object.keys(persistedPlans).length > 0
  ? persistedPlans
  : { [defaultPlan.id]: defaultPlan };

const initialActivePlanId = persistedActivePlanId && initialPlans[persistedActivePlanId]
  ? persistedActivePlanId
  : Object.keys(initialPlans)[0];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  // Plan data
  activePlanId: initialActivePlanId,
  plans: initialPlans,

  // Editor state
  selectedIds: [],
  hoveredId: null,
  activeTool: 'select',
  drawingState: null,
  wallChain: [],
  ghostPoint: null,

  // Settings
  settings: { ...DEFAULT_SETTINGS, ...persistedSettings },

  // UI state
  showGrid: true,
  layers: DEFAULT_LAYERS,
  pendingFurnitureTemplateId: null,
  toasts: [],

  // Background reference images (not persisted, not in undo history)
  backgroundImages: {},
  calibrationLine: null,

  // History
  past: [],
  future: [],

  // ─── Wall actions ───────────────────────────────────────────────────────────
  addWall: (start, end) => {
    withHistory(set, get, plan => ({
      ...plan,
      walls: [...plan.walls, { id: uuid(), start, end, thickness: get().settings.defaultWallThickness, height: 244, color: '#2d2d2d', layer: 'interior' }],
    }));
  },

  updateWall: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      walls: plan.walls.map(w => w.id === id ? { ...w, ...changes } : w),
    }));
  },

  setWallLength: (id, newLengthCm) => {
    withHistory(set, get, plan => {
      const wall = plan.walls.find(w => w.id === id);
      if (!wall) return plan;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const currentLen = Math.hypot(dx, dy);
      if (currentLen < 0.01) return plan; // degenerate — no direction to follow
      const dirX = dx / currentLen;
      const dirY = dy / currentLen;
      const newEnd = {
        x: wall.start.x + dirX * newLengthCm,
        y: wall.start.y + dirY * newLengthCm,
      };
      const oldEnd = wall.end;
      return {
        ...plan,
        walls: plan.walls.map(w => {
          if (w.id === id) return { ...w, end: newEnd };
          if (Math.hypot(w.start.x - oldEnd.x, w.start.y - oldEnd.y) < 1.0) return { ...w, start: newEnd };
          if (Math.hypot(w.end.x - oldEnd.x, w.end.y - oldEnd.y) < 1.0) return { ...w, end: newEnd };
          return w;
        }),
      };
    });
  },

  deleteWall: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      walls: plan.walls.filter(w => w.id !== id),
      openings: plan.openings.filter(o => o.wallId !== id),
    }));
  },

  // ─── Opening actions ────────────────────────────────────────────────────────
  addOpening: (opening) => {
    withHistory(set, get, plan => ({
      ...plan,
      openings: [...plan.openings, { id: uuid(), ...opening }],
    }));
  },

  updateOpening: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      openings: plan.openings.map(o => o.id === id ? { ...o, ...changes } : o),
    }));
  },

  deleteOpening: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      openings: plan.openings.filter(o => o.id !== id),
    }));
  },

  // ─── Room actions ───────────────────────────────────────────────────────────
  addRoom: (room) => {
    withHistory(set, get, plan => ({
      ...plan,
      rooms: [...plan.rooms, { id: uuid(), ...room }],
    }));
  },

  updateRoom: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      rooms: plan.rooms.map(r => r.id === id ? { ...r, ...changes } : r),
    }));
  },

  deleteRoom: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      rooms: plan.rooms.filter(r => r.id !== id),
    }));
  },

  // ─── Furniture actions ──────────────────────────────────────────────────────
  addFurniture: (item) => {
    withHistory(set, get, plan => ({
      ...plan,
      furniture: [...plan.furniture, { id: uuid(), ...item }],
    }));
  },

  updateFurniture: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      furniture: plan.furniture.map(f => f.id === id ? { ...f, ...changes } : f),
    }));
  },

  deleteFurniture: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      furniture: plan.furniture.filter(f => f.id !== id),
    }));
  },

  // ─── Dimension actions ──────────────────────────────────────────────────────
  addDimension: (dim) => {
    withHistory(set, get, plan => ({
      ...plan,
      dimensions: [...plan.dimensions, { id: uuid(), ...dim }],
    }));
  },

  updateDimension: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      dimensions: plan.dimensions.map(d => d.id === id ? { ...d, ...changes } : d),
    }));
  },

  deleteDimension: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      dimensions: plan.dimensions.filter(d => d.id !== id),
    }));
  },

  // ─── Text label actions ─────────────────────────────────────────────────────
  addTextLabel: (label) => {
    withHistory(set, get, plan => ({
      ...plan,
      textLabels: [...plan.textLabels, { id: uuid(), ...label }],
    }));
  },

  updateTextLabel: (id, changes) => {
    withHistory(set, get, plan => ({
      ...plan,
      textLabels: plan.textLabels.map(t => t.id === id ? { ...t, ...changes } : t),
    }));
  },

  deleteTextLabel: (id) => {
    withHistory(set, get, plan => ({
      ...plan,
      textLabels: plan.textLabels.filter(t => t.id !== id),
    }));
  },

  // ─── Multi-element actions ──────────────────────────────────────────────────
  deleteElements: (ids) => {
    const idSet = new Set(ids);
    withHistory(set, get, plan => ({
      ...plan,
      walls: plan.walls.filter(w => !idSet.has(w.id)),
      openings: plan.openings.filter(o => !idSet.has(o.id) && !idSet.has(o.wallId)),
      rooms: plan.rooms.filter(r => !idSet.has(r.id)),
      furniture: plan.furniture.filter(f => !idSet.has(f.id)),
      dimensions: plan.dimensions.filter(d => !idSet.has(d.id)),
      textLabels: plan.textLabels.filter(t => !idSet.has(t.id)),
    }));
    set(s => ({ selectedIds: s.selectedIds.filter(id => !idSet.has(id)) }));
  },

  moveElements: (ids, dx, dy) => {
    const idSet = new Set(ids);
    withHistory(set, get, plan => ({
      ...plan,
      walls: plan.walls.map(w => idSet.has(w.id)
        ? { ...w, start: { x: w.start.x + dx, y: w.start.y + dy }, end: { x: w.end.x + dx, y: w.end.y + dy } }
        : w),
      rooms: plan.rooms.map(r => idSet.has(r.id)
        ? { ...r, points: r.points.map(p => ({ x: p.x + dx, y: p.y + dy })), labelPosition: { x: r.labelPosition.x + dx, y: r.labelPosition.y + dy } }
        : r),
      furniture: plan.furniture.map(f => idSet.has(f.id)
        ? { ...f, position: { x: f.position.x + dx, y: f.position.y + dy } }
        : f),
      dimensions: plan.dimensions.map(d => idSet.has(d.id)
        ? { ...d, start: { x: d.start.x + dx, y: d.start.y + dy }, end: { x: d.end.x + dx, y: d.end.y + dy }, startWallId: undefined, endWallId: undefined }
        : d),
      textLabels: plan.textLabels.map(t => idSet.has(t.id)
        ? { ...t, position: { x: t.position.x + dx, y: t.position.y + dy } }
        : t),
    }));
  },

  setActivePlanNoHistory: (plan) => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    set({ plans: { ...plans, [activePlanId]: plan } });
  },

  updateWallEndpoints: (updates) => {
    const updateMap = new Map(updates.map(u => [`${u.id}:${u.endpoint}`, u.position]));
    withHistory(set, get, plan => ({
      ...plan,
      walls: plan.walls.map(w => {
        const newStart = updateMap.get(`${w.id}:start`);
        const newEnd = updateMap.get(`${w.id}:end`);
        if (!newStart && !newEnd) return w;
        return { ...w, start: newStart ?? w.start, end: newEnd ?? w.end };
      }),
    }));
  },

  // ─── Selection / UI ─────────────────────────────────────────────────────────
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPendingFurnitureTemplate: (templateId) => set({ pendingFurnitureTemplateId: templateId }),
  setDrawingState: (state) => set({ drawingState: state }),
  setGhostPoint: (p) => set({ ghostPoint: p }),
  pushToChain: (p) => set(s => ({ wallChain: [...s.wallChain, p] })),
  clearChain: () => set({ wallChain: [], ghostPoint: null }),

  setCamera: (changes) => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    const plan = plans[activePlanId];
    set({
      plans: {
        ...plans,
        [activePlanId]: {
          ...plan,
          viewport: { ...plan.viewport, ...changes },
        },
      },
    });
  },

  setLayer: (name, changes) => {
    set(s => ({
      layers: {
        ...s.layers,
        [name]: { ...s.layers[name], ...changes },
      },
    }));
  },

  // ─── Undo / Redo ────────────────────────────────────────────────────────────
  undo: () => {
    const { past, plans, activePlanId, future } = get();
    if (past.length === 0 || !activePlanId) return;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      plans: { ...plans, [activePlanId]: previous },
      future: [plans[activePlanId], ...future].slice(0, 100),
    });
  },

  redo: () => {
    const { future, plans, activePlanId, past } = get();
    if (future.length === 0 || !activePlanId) return;
    const next = future[0];
    set({
      future: future.slice(1),
      plans: { ...plans, [activePlanId]: next },
      past: [...past, plans[activePlanId]].slice(-100),
    });
  },

  // ─── Plan management ─────────────────────────────────────────────────────────
  loadPlan: (plan) => {
    set(s => ({
      plans: { ...s.plans, [plan.id]: plan },
      activePlanId: plan.id,
      past: [],
      future: [],
      selectedIds: [],
    }));
  },

  newPlan: (name) => {
    const plan = { ...makeDefaultPlan(), name };
    set(s => ({
      plans: { ...s.plans, [plan.id]: plan },
      activePlanId: plan.id,
      past: [],
      future: [],
      selectedIds: [],
    }));
  },

  deletePlan: (id) => {
    const { plans, activePlanId } = get();
    const remaining = Object.fromEntries(Object.entries(plans).filter(([k]) => k !== id));
    if (Object.keys(remaining).length === 0) {
      const fresh = makeDefaultPlan();
      remaining[fresh.id] = fresh;
    }
    const newActiveId = activePlanId === id ? Object.keys(remaining)[0] : activePlanId;
    set({ plans: remaining, activePlanId: newActiveId, past: [], future: [] });
  },

  switchPlan: (id) => {
    set({ activePlanId: id, past: [], future: [], selectedIds: [] });
  },

  // ─── Settings ───────────────────────────────────────────────────────────────
  updateSettings: (changes) => {
    set(s => {
      const updated = { ...s.settings, ...changes };
      saveToStorage(STORAGE_KEYS.settings, updated);
      return { settings: updated };
    });
  },

  updateDocument: (changes) => {
    withHistory(set, get, plan => ({ ...plan, ...changes }));
  },

  // ─── Toasts ─────────────────────────────────────────────────────────────────
  addToast: (message, type = 'info', durationMs = 3000) => {
    const toast: Toast = { id: uuid(), message, type, durationMs };
    set(s => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => get().dismissToast(toast.id), durationMs);
  },

  dismissToast: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  // ─── UI helpers ──────────────────────────────────────────────────────────────
  toggleShowGrid: () => set(s => ({ showGrid: !s.showGrid })),

  toggleSnapToGrid: () => set(s => ({
    settings: { ...s.settings, snapToGrid: !s.settings.snapToGrid },
  })),

  forceSave: () => {
    const { plans, activePlanId, settings } = get();
    saveToStorage(STORAGE_KEYS.plans, plans);
    if (activePlanId) saveToStorage(STORAGE_KEYS.activePlanId, activePlanId);
    saveToStorage(STORAGE_KEYS.settings, settings);
  },

  selectAll: () => {
    const { activePlanId, plans, layers } = get();
    if (!activePlanId) return;
    const plan = plans[activePlanId];
    const ids: string[] = [];
    if (layers.structure.visible && !layers.structure.locked) {
      plan.walls.forEach(w => ids.push(w.id));
      plan.rooms.forEach(r => ids.push(r.id));
    }
    if (layers.furniture.visible && !layers.furniture.locked) {
      plan.furniture.forEach(f => ids.push(f.id));
    }
    if (layers.annotations.visible && !layers.annotations.locked) {
      plan.dimensions.forEach(d => ids.push(d.id));
      plan.textLabels.forEach(t => ids.push(t.id));
    }
    set({ selectedIds: ids });
  },

  zoomIn: () => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    const vp = plans[activePlanId].viewport;
    get().setCamera({ zoom: Math.min(vp.zoom * 1.25, 8.0) });
  },

  zoomOut: () => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    const vp = plans[activePlanId].viewport;
    get().setCamera({ zoom: Math.max(vp.zoom / 1.25, 0.1) });
  },

  fitToScreen: (canvasWidth, canvasHeight) => {
    const { activePlanId, plans } = get();
    if (!activePlanId) return;
    const plan = plans[activePlanId];
    const PADDING = 40; // px
    const BASE_PX_PER_CM = 4;
    const scaleX = (canvasWidth - PADDING * 2) / (plan.width * BASE_PX_PER_CM);
    const scaleY = (canvasHeight - PADDING * 2) / (plan.height * BASE_PX_PER_CM);
    const zoom = Math.min(scaleX, scaleY, 8.0);
    const panX = (canvasWidth - plan.width * BASE_PX_PER_CM * zoom) / 2;
    const panY = (canvasHeight - plan.height * BASE_PX_PER_CM * zoom) / 2;
    get().setCamera({ zoom, panX, panY });
  },

  // ─── Background reference image ───────────────────────────────────────────
  setBackgroundImage: (planId, bg) => {
    set(s => {
      if (!bg) {
        const { [planId]: _removed, ...rest } = s.backgroundImages;
        return { backgroundImages: rest };
      }
      return { backgroundImages: { ...s.backgroundImages, [planId]: bg } };
    });
  },

  updateBackgroundImage: (planId, patch) => {
    set(s => {
      const existing = s.backgroundImages[planId];
      if (!existing) return {};
      return { backgroundImages: { ...s.backgroundImages, [planId]: { ...existing, ...patch } } };
    });
  },

  setCalibrationLine: (line) => {
    set({ calibrationLine: line });
  },
}));

// ─── Auto-save subscription ──────────────────────────────────────────────────
// Debounced: save 1s after last change
let saveTimer: ReturnType<typeof setTimeout> | null = null;

useStore.subscribe((state, prev) => {
  if (state.plans !== prev.plans || state.activePlanId !== prev.activePlanId) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.plans, state.plans);
      saveToStorage(STORAGE_KEYS.activePlanId, state.activePlanId);
    }, 1000);
  }
});
