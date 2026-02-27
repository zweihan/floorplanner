import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { distance } from '../geometry/point';
import { formatMeasurement, parseLength } from '../geometry/units';
import { shoelaceArea } from '../geometry/polygon';
import type { DisplayUnit, Opening, Plan } from '../types/plan';

// ─── Layout helper ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-xs text-gray-500 shrink-0 w-16">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Wall Properties ──────────────────────────────────────────────────────────

function WallProperties({ wallId }: { wallId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateWall = useStore(s => s.updateWall);
  const setWallLength = useStore(s => s.setWallLength);
  const wall = plan?.walls.find(w => w.id === wallId);

  const [thickness, setThickness] = useState(wall?.thickness ?? 15);
  // Length input: stores what the user is currently typing
  const [lengthInput, setLengthInput] = useState('');
  const [editingLength, setEditingLength] = useState(false);

  // Sync local state when wall changes externally (e.g. undo/redo)
  useEffect(() => {
    if (wall) setThickness(wall.thickness);
  }, [wall?.thickness]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!wall) return null;

  const unit = (plan.unit === 'in' ? 'cm' : plan.unit) as DisplayUnit;
  const length = distance(wall.start, wall.end);

  const commitThickness = () => {
    const v = Math.max(1, Math.min(100, thickness));
    setThickness(v);
    if (v !== wall.thickness) updateWall(wallId, { thickness: v });
  };

  const handleLengthFocus = () => {
    // Show the raw number in the current unit so the user knows what to type
    const raw = unit === 'm'
      ? (length / 100).toFixed(2)
      : unit === 'ft'
        ? (length / 30.48).toFixed(2)
        : length.toFixed(1);
    setLengthInput(raw);
    setEditingLength(true);
  };

  const commitLength = () => {
    setEditingLength(false);
    const parsed = parseLength(lengthInput, unit);
    if (parsed !== null && parsed > 0.5 && Math.abs(parsed - length) > 0.1) {
      setWallLength(wallId, parsed);
    }
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wall</p>

      <Row label="Length">
        <input
          type="text"
          value={editingLength ? lengthInput : formatMeasurement(length, unit)}
          onChange={e => setLengthInput(e.target.value)}
          onFocus={handleLengthFocus}
          onBlur={commitLength}
          onKeyDown={e => {
            if (e.key === 'Enter') commitLength();
            if (e.key === 'Escape') setEditingLength(false);
          }}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          title="Click to edit wall length"
        />
      </Row>

      <Row label="Thickness">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1} max={100} step={1}
            value={thickness}
            onChange={e => setThickness(Number(e.target.value))}
            onBlur={commitThickness}
            onKeyDown={e => e.key === 'Enter' && commitThickness()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      <Row label="Layer">
        <select
          value={wall.layer}
          onChange={e => updateWall(wallId, { layer: e.target.value as 'interior' | 'exterior' })}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="interior">Interior</option>
          <option value="exterior">Exterior</option>
        </select>
      </Row>

      <Row label="Color">
        <div className="flex items-center gap-2 justify-end">
          <input
            type="color"
            value={wall.color}
            onChange={e => updateWall(wallId, { color: e.target.value })}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer p-0"
            title="Wall colour"
          />
          <span className="text-xs text-gray-400 font-mono">{wall.color}</span>
        </div>
      </Row>

      <div className="border-t border-gray-100 pt-2 space-y-1">
        <p className="text-xs text-gray-400 font-mono">
          Start ({wall.start.x.toFixed(1)}, {wall.start.y.toFixed(1)})
        </p>
        <p className="text-xs text-gray-400 font-mono">
          End ({wall.end.x.toFixed(1)}, {wall.end.y.toFixed(1)})
        </p>
      </div>
    </div>
  );
}

// ─── Document Properties (nothing selected) ───────────────────────────────────

function DocumentProperties() {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateDocument = useStore(s => s.updateDocument);

  const [name, setName] = useState(plan?.name ?? '');
  const [gridSize, setGridSize] = useState(plan?.gridSize ?? 10);

  useEffect(() => {
    if (plan) { setName(plan.name); setGridSize(plan.gridSize); }
  }, [plan?.name, plan?.gridSize]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) return null;

  const commitName = () => {
    const v = name.trim() || 'Untitled Plan';
    setName(v);
    if (v !== plan.name) updateDocument({ name: v });
  };

  const commitGridSize = () => {
    const v = Math.max(1, Math.min(100, gridSize));
    setGridSize(v);
    if (v !== plan.gridSize) updateDocument({ gridSize: v });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document</p>

      <Row label="Name">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </Row>

      <Row label="Unit">
        <select
          value={plan.unit}
          onChange={e => updateDocument({ unit: e.target.value as Plan['unit'] })}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="cm">Centimetres (cm)</option>
          <option value="m">Metres (m)</option>
          <option value="ft">Feet / inches</option>
        </select>
      </Row>

      <Row label="Grid">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1} max={100} step={1}
            value={gridSize}
            onChange={e => setGridSize(Number(e.target.value))}
            onBlur={commitGridSize}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>
    </div>
  );
}

// ─── Room Properties ─────────────────────────────────────────────────────────

function RoomProperties({ roomId }: { roomId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateRoom = useStore(s => s.updateRoom);
  const room = plan?.rooms.find(r => r.id === roomId);

  const [name, setName] = useState(room?.name ?? '');
  useEffect(() => { if (room) setName(room.name); }, [room?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room) return null;

  const unit = (plan.unit === 'in' ? 'cm' : plan.unit) as DisplayUnit;
  const areaCm2 = shoelaceArea(room.points);
  const areaLabel = unit === 'm'
    ? `${(areaCm2 / 10000).toFixed(2)} m²`
    : unit === 'ft'
      ? `${(areaCm2 / 929.03).toFixed(1)} ft²`
      : `${Math.round(areaCm2)} cm²`;

  const commitName = () => {
    const v = name.trim() || 'Room';
    setName(v);
    if (v !== room.name) updateRoom(roomId, { name: v });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Room</p>

      <Row label="Name">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </Row>

      <Row label="Area">
        <span className="text-xs text-gray-700 text-right block font-mono">{areaLabel}</span>
      </Row>

      <Row label="Color">
        <div className="flex items-center gap-2 justify-end">
          <input
            type="color"
            value={room.color}
            onChange={e => updateRoom(roomId, { color: e.target.value })}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer p-0"
          />
          <span className="text-xs text-gray-400 font-mono">{room.color}</span>
        </div>
      </Row>

      <div className="flex items-center gap-3 pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={room.showLabel}
            onChange={e => updateRoom(roomId, { showLabel: e.target.checked })}
            className="w-3 h-3"
          />
          <span className="text-xs text-gray-600">Name</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={room.showArea}
            onChange={e => updateRoom(roomId, { showArea: e.target.checked })}
            className="w-3 h-3"
          />
          <span className="text-xs text-gray-600">Area</span>
        </label>
      </div>
    </div>
  );
}

// ─── Opening Properties ───────────────────────────────────────────────────────

function OpeningProperties({ openingId }: { openingId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateOpening = useStore(s => s.updateOpening);
  const opening = plan?.openings.find(o => o.id === openingId);

  const [width, setWidth] = useState(opening?.width ?? 90);
  const [height, setHeight] = useState(opening?.height ?? 210);
  const [openAngle, setOpenAngle] = useState(opening?.openAngle ?? 90);

  useEffect(() => {
    if (opening) {
      setWidth(opening.width);
      setHeight(opening.height);
      setOpenAngle(opening.openAngle);
    }
  }, [opening?.width, opening?.height, opening?.openAngle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!opening) return null;

  const isDoor = opening.type === 'door' || opening.type === 'double-door' || opening.type === 'sliding-door';
  const isWindow = opening.type === 'window' || opening.type === 'bay-window';

  const commitWidth = () => {
    const v = Math.max(5, Math.min(500, width));
    setWidth(v);
    if (v !== opening.width) updateOpening(openingId, { width: v });
  };

  const commitHeight = () => {
    const v = Math.max(5, Math.min(400, height));
    setHeight(v);
    if (v !== opening.height) updateOpening(openingId, { height: v });
  };

  const commitOpenAngle = () => {
    const v = Math.max(10, Math.min(180, openAngle));
    setOpenAngle(v);
    if (v !== opening.openAngle) updateOpening(openingId, { openAngle: v });
  };

  const typeLabels: Record<Opening['type'], string> = {
    door: 'Door',
    'double-door': 'Double Door',
    'sliding-door': 'Sliding Door',
    window: 'Window',
    'bay-window': 'Bay Window',
    opening: 'Opening',
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {typeLabels[opening.type] ?? 'Opening'}
      </p>

      <Row label="Type">
        <select
          value={opening.type}
          onChange={e => updateOpening(openingId, { type: e.target.value as Opening['type'] })}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="door">Door</option>
          <option value="double-door">Double Door</option>
          <option value="sliding-door">Sliding Door</option>
          <option value="window">Window</option>
          <option value="bay-window">Bay Window</option>
          <option value="opening">Opening</option>
        </select>
      </Row>

      <Row label="Width">
        <div className="flex items-center gap-1">
          <input
            type="number" min={5} max={500} step={1}
            value={width}
            onChange={e => setWidth(Number(e.target.value))}
            onBlur={commitWidth}
            onKeyDown={e => e.key === 'Enter' && commitWidth()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      {(isDoor || isWindow) && (
        <Row label="Height">
          <div className="flex items-center gap-1">
            <input
              type="number" min={5} max={400} step={1}
              value={height}
              onChange={e => setHeight(Number(e.target.value))}
              onBlur={commitHeight}
              onKeyDown={e => e.key === 'Enter' && commitHeight()}
              className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400 shrink-0">cm</span>
          </div>
        </Row>
      )}

      {isDoor && (
        <>
          <Row label="Angle">
            <div className="flex items-center gap-1">
              <input
                type="number" min={10} max={180} step={5}
                value={openAngle}
                onChange={e => setOpenAngle(Number(e.target.value))}
                onBlur={commitOpenAngle}
                onKeyDown={e => e.key === 'Enter' && commitOpenAngle()}
                className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-400 shrink-0">°</span>
            </div>
          </Row>
          <div className="flex items-center gap-3 pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={opening.flipSide}
                onChange={e => updateOpening(openingId, { flipSide: e.target.checked })}
                className="w-3 h-3"
              />
              <span className="text-xs text-gray-600">Flip side</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Furniture Properties ─────────────────────────────────────────────────────

function FurnitureProperties({ furnitureId }: { furnitureId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateFurniture = useStore(s => s.updateFurniture);
  const item = plan?.furniture.find(f => f.id === furnitureId);

  const [label, setLabel] = useState(item?.label ?? '');
  const [width, setWidth] = useState(item?.width ?? 100);
  const [depth, setDepth] = useState(item?.depth ?? 100);
  const [rotation, setRotation] = useState(item?.rotation ?? 0);

  useEffect(() => {
    if (item) { setLabel(item.label); setWidth(item.width); setDepth(item.depth); setRotation(item.rotation); }
  }, [item?.label, item?.width, item?.depth, item?.rotation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const commit = (field: 'width' | 'depth', value: number) => {
    const v = Math.max(5, value);
    if (field === 'width') { setWidth(v); if (v !== item.width) updateFurniture(furnitureId, { width: v }); }
    else { setDepth(v); if (v !== item.depth) updateFurniture(furnitureId, { depth: v }); }
  };

  const commitRotation = () => {
    const v = ((rotation % 360) + 360) % 360;
    setRotation(v);
    if (Math.abs(v - item.rotation) > 0.01) updateFurniture(furnitureId, { rotation: v });
  };

  const commitLabel = () => {
    const v = label.trim() || item.templateId;
    setLabel(v);
    if (v !== item.label) updateFurniture(furnitureId, { label: v });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Furniture</p>

      <Row label="Label">
        <input
          type="text" value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </Row>

      <Row label="Width">
        <div className="flex items-center gap-1">
          <input
            type="number" min={5} step={1} value={width}
            onChange={e => setWidth(Number(e.target.value))}
            onBlur={() => commit('width', width)}
            onKeyDown={e => e.key === 'Enter' && commit('width', width)}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      <Row label="Depth">
        <div className="flex items-center gap-1">
          <input
            type="number" min={5} step={1} value={depth}
            onChange={e => setDepth(Number(e.target.value))}
            onBlur={() => commit('depth', depth)}
            onKeyDown={e => e.key === 'Enter' && commit('depth', depth)}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      <Row label="Rotation">
        <div className="flex items-center gap-1">
          <input
            type="number" min={0} max={359} step={15} value={Math.round(rotation)}
            onChange={e => setRotation(Number(e.target.value))}
            onBlur={commitRotation}
            onKeyDown={e => e.key === 'Enter' && commitRotation()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">°</span>
        </div>
      </Row>

      <Row label="Color">
        <div className="flex items-center gap-2 justify-end">
          <input
            type="color" value={item.color}
            onChange={e => updateFurniture(furnitureId, { color: e.target.value })}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer p-0"
          />
          <span className="text-xs text-gray-400 font-mono">{item.color}</span>
        </div>
      </Row>
    </div>
  );
}

// ─── Dimension Properties ─────────────────────────────────────────────────────

function DimensionProperties({ dimId }: { dimId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateDimension = useStore(s => s.updateDimension);
  const dim = plan?.dimensions.find(d => d.id === dimId);

  const [offset, setOffset] = useState(dim?.offset ?? 12);
  const [overrideText, setOverrideText] = useState(dim?.overrideText ?? '');

  useEffect(() => {
    if (dim) { setOffset(dim.offset); setOverrideText(dim.overrideText ?? ''); }
  }, [dim?.offset, dim?.overrideText]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dim) return null;

  const unit = (plan.unit === 'in' ? 'cm' : plan.unit) as DisplayUnit;
  const measuredLen = distance(dim.start, dim.end);

  const commitOffset = () => {
    updateDimension(dimId, { offset });
  };

  const commitOverride = () => {
    updateDimension(dimId, { overrideText: overrideText.trim() || null });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dimension</p>

      <Row label="Length">
        <span className="text-xs text-gray-700 text-right block font-mono">
          {formatMeasurement(measuredLen, unit)}
        </span>
      </Row>

      <Row label="Offset">
        <div className="flex items-center gap-1">
          <input
            type="number" step={1} value={Math.round(offset)}
            onChange={e => setOffset(Number(e.target.value))}
            onBlur={commitOffset}
            onKeyDown={e => e.key === 'Enter' && commitOffset()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      <Row label="Label">
        <input
          type="text"
          value={overrideText}
          placeholder={formatMeasurement(measuredLen, unit)}
          onChange={e => setOverrideText(e.target.value)}
          onBlur={commitOverride}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          title="Override the displayed label (leave empty for auto)"
        />
      </Row>
    </div>
  );
}

// ─── Text Label Properties ────────────────────────────────────────────────────

function TextLabelProperties({ labelId }: { labelId: string }) {
  const plan = useStore(s => s.plans[s.activePlanId!]);
  const updateTextLabel = useStore(s => s.updateTextLabel);
  const setEditingTextLabelId = useStore(s => s.setEditingTextLabelId);
  const label = plan?.textLabels.find(t => t.id === labelId);

  const [fontSize, setFontSize] = useState(label?.fontSize ?? 14);

  useEffect(() => {
    if (label) setFontSize(label.fontSize);
  }, [label?.fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!label) return null;

  const commitFontSize = () => {
    const v = Math.max(4, Math.min(200, fontSize));
    setFontSize(v);
    if (v !== label.fontSize) updateTextLabel(labelId, { fontSize: v });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Text Label</p>

      <Row label="Text">
        <button
          onClick={() => setEditingTextLabelId(labelId)}
          className="w-full text-left border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-700 truncate hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
          title="Click to edit text"
        >
          {label.text || <span className="text-gray-400 italic">empty</span>}
        </button>
      </Row>

      <Row label="Size">
        <div className="flex items-center gap-1">
          <input
            type="number" min={4} max={200} step={1}
            value={Math.round(fontSize)}
            onChange={e => setFontSize(Number(e.target.value))}
            onBlur={commitFontSize}
            onKeyDown={e => e.key === 'Enter' && commitFontSize()}
            className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400 shrink-0">cm</span>
        </div>
      </Row>

      <Row label="Align">
        <select
          value={label.align}
          onChange={e => updateTextLabel(labelId, { align: e.target.value as 'left' | 'center' | 'right' })}
          className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Row>

      <Row label="Color">
        <div className="flex items-center gap-2 justify-end">
          <input
            type="color" value={label.color}
            onChange={e => updateTextLabel(labelId, { color: e.target.value })}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer p-0"
          />
          <span className="text-xs text-gray-400 font-mono">{label.color}</span>
        </div>
      </Row>
    </div>
  );
}

// ─── Multi-select ─────────────────────────────────────────────────────────────

function MultiSelectProperties({ count }: { count: number }) {
  const deleteElements = useStore(s => s.deleteElements);
  const selectedIds = useStore(s => s.selectedIds);
  const setSelectedIds = useStore(s => s.setSelectedIds);

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selection</p>
      <p className="text-xs text-gray-600">{count} element{count !== 1 ? 's' : ''} selected</p>
      <button
        onClick={() => { deleteElements(selectedIds); setSelectedIds([]); }}
        className="w-full px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
      >
        Delete All
      </button>
    </div>
  );
}

// ─── Root panel ───────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const selectedIds = useStore(s => s.selectedIds);
  const plan = useStore(s => s.plans[s.activePlanId!]);

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const singleWall      = singleId ? plan?.walls.find(w => w.id === singleId) ?? null : null;
  const singleRoom      = singleId ? plan?.rooms.find(r => r.id === singleId) ?? null : null;
  const singleOpening   = singleId ? plan?.openings.find(o => o.id === singleId) ?? null : null;
  const singleFurniture = singleId ? plan?.furniture.find(f => f.id === singleId) ?? null : null;
  const singleDimension = singleId ? plan?.dimensions.find(d => d.id === singleId) ?? null : null;
  const singleTextLabel = singleId ? plan?.textLabels.find(t => t.id === singleId) ?? null : null;

  return (
    <aside className="w-60 bg-white border-l border-gray-200 shrink-0 p-3 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Properties</p>
      {selectedIds.length === 0 ? (
        <DocumentProperties />
      ) : singleWall ? (
        <WallProperties wallId={singleId!} />
      ) : singleRoom ? (
        <RoomProperties roomId={singleId!} />
      ) : singleOpening ? (
        <OpeningProperties openingId={singleId!} />
      ) : singleFurniture ? (
        <FurnitureProperties furnitureId={singleId!} />
      ) : singleDimension ? (
        <DimensionProperties dimId={singleId!} />
      ) : singleTextLabel ? (
        <TextLabelProperties labelId={singleId!} />
      ) : (
        <MultiSelectProperties count={selectedIds.length} />
      )}
    </aside>
  );
}
