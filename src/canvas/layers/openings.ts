import type { Wall, Opening, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import { worldToScreen } from '../../geometry/transforms';

export interface OpeningGhost {
  wallId: string;
  t: number;
}

// ─── Public drawing functions ────────────────────────────────────────────────

export function drawOpenings(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  openings: Opening[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  const isDark = settings.theme === 'dark';
  for (const opening of openings) {
    const wall = walls.find(w => w.id === opening.wallId);
    if (!wall) continue;
    _renderOnWall(ctx, wall, opening, viewport, ppcm, isDark);
  }
}

export function drawOpeningGhost(
  ctx: CanvasRenderingContext2D,
  walls: Wall[],
  ghost: OpeningGhost,
  openingType: Opening['type'],
  viewport: Viewport,
  ppcm: number
): void {
  const wall = walls.find(w => w.id === ghost.wallId);
  if (!wall) return;

  const s = worldToScreen(wall.start.x, wall.start.y, viewport, ppcm);
  const e = worldToScreen(wall.end.x, wall.end.y, viewport, ppcm);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  const angle = Math.atan2(dy, dx);
  const halfThick = (wall.thickness / 2) * ppcm * viewport.zoom;
  const defaultWidth = (openingType === 'door' || openingType === 'opening') ? 90 : 100;
  const openScreenWidth = defaultWidth * ppcm * viewport.zoom;
  const openStartX = ghost.t * len - openScreenWidth / 2;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
  ctx.fillRect(openStartX, -halfThick, openScreenWidth, halfThick * 2);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(openStartX, -halfThick, openScreenWidth, halfThick * 2);
  ctx.setLineDash([]);

  ctx.restore();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _renderOnWall(
  ctx: CanvasRenderingContext2D,
  wall: Wall,
  opening: Opening,
  viewport: Viewport,
  ppcm: number,
  isDark: boolean
): void {
  const s = worldToScreen(wall.start.x, wall.start.y, viewport, ppcm);
  const e = worldToScreen(wall.end.x, wall.end.y, viewport, ppcm);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  const angle = Math.atan2(dy, dx);
  const halfThick = (wall.thickness / 2) * ppcm * viewport.zoom;
  const openScreenWidth = opening.width * ppcm * viewport.zoom;
  const openCenterX = opening.position * len;
  const openStartX = openCenterX - openScreenWidth / 2;
  const openEndX = openCenterX + openScreenWidth / 2;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);
  ctx.strokeStyle = isDark ? '#aaaaaa' : '#333333';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  _drawSymbol(ctx, opening, openStartX, openEndX, openScreenWidth, halfThick);

  ctx.restore();
}

/**
 * Draws the opening symbol in wall-local coordinates:
 *   x-axis = along wall (start→end)
 *   y-axis = perpendicular (negative y = "top" side; sideSign = ±1 picks side)
 */
function _drawSymbol(
  ctx: CanvasRenderingContext2D,
  opening: Opening,
  openStartX: number,
  openEndX: number,
  openScreenWidth: number,
  halfThick: number
): void {
  const openAngleRad = (opening.openAngle || 90) * Math.PI / 180;
  // sideSign=-1 → top side (-y in canvas local coords), +1 → bottom side
  const sideSign = opening.flipSide ? 1 : -1;

  switch (opening.type) {
    case 'door': {
      // Door leaf: from hinge (openStartX, 0) to open position
      const leafEndX = openStartX + openScreenWidth * Math.cos(openAngleRad);
      const leafEndY = sideSign * openScreenWidth * Math.sin(openAngleRad);
      ctx.beginPath();
      ctx.moveTo(openStartX, 0);
      ctx.lineTo(leafEndX, leafEndY);
      ctx.stroke();
      // Arc: traces swing path from closed (openEndX) to open position
      // startAngle=0 (pointing along +x toward openEndX), endAngle=sideSign*rad
      ctx.beginPath();
      ctx.arc(openStartX, 0, openScreenWidth, 0, sideSign * openAngleRad, sideSign < 0);
      ctx.stroke();
      // Frame jamb lines
      ctx.beginPath();
      ctx.moveTo(openStartX, -halfThick);
      ctx.lineTo(openStartX, halfThick);
      ctx.moveTo(openEndX, -halfThick);
      ctx.lineTo(openEndX, halfThick);
      ctx.stroke();
      break;
    }

    case 'double-door': {
      const halfW = openScreenWidth / 2;
      const centerX = openStartX + halfW;

      // Left leaf — hinge at openStartX, same as single door but half-width
      const lLeafEndX = openStartX + halfW * Math.cos(openAngleRad);
      const lLeafEndY = sideSign * halfW * Math.sin(openAngleRad);
      ctx.beginPath();
      ctx.moveTo(openStartX, 0);
      ctx.lineTo(lLeafEndX, lLeafEndY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(openStartX, 0, halfW, 0, sideSign * openAngleRad, sideSign < 0);
      ctx.stroke();

      // Right leaf — hinge at openEndX, mirrored
      const rLeafEndX = openEndX - halfW * Math.cos(openAngleRad);
      const rLeafEndY = sideSign * halfW * Math.sin(openAngleRad);
      ctx.beginPath();
      ctx.moveTo(openEndX, 0);
      ctx.lineTo(rLeafEndX, rLeafEndY);
      ctx.stroke();
      // Arc goes from π (pointing left) toward 12/6 o'clock
      ctx.beginPath();
      ctx.arc(openEndX, 0, halfW, Math.PI, Math.PI - sideSign * openAngleRad, sideSign >= 0);
      ctx.stroke();

      // Jamb lines at both edges + center divider
      ctx.beginPath();
      ctx.moveTo(openStartX, -halfThick);
      ctx.lineTo(openStartX, halfThick);
      ctx.moveTo(centerX, -halfThick);
      ctx.lineTo(centerX, halfThick);
      ctx.moveTo(openEndX, -halfThick);
      ctx.lineTo(openEndX, halfThick);
      ctx.stroke();
      break;
    }

    case 'sliding-door': {
      // Two overlapping panel rectangles
      const panelW = openScreenWidth / 2;
      const overlap = panelW * 0.25;
      ctx.beginPath();
      ctx.rect(openStartX, -halfThick * 0.55, panelW, halfThick * 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(openStartX + panelW - overlap, -halfThick * 0.55, panelW, halfThick * 1.1);
      ctx.stroke();
      break;
    }

    case 'opening': {
      // Plain passage — jamb lines only, no door leaf or glass
      ctx.beginPath();
      ctx.moveTo(openStartX, -halfThick);
      ctx.lineTo(openStartX, halfThick);
      ctx.moveTo(openEndX, -halfThick);
      ctx.lineTo(openEndX, halfThick);
      ctx.stroke();
      break;
    }

    case 'window':
    case 'bay-window': {
      // Frame jamb lines + two glass lines
      ctx.beginPath();
      ctx.moveTo(openStartX, -halfThick);
      ctx.lineTo(openStartX, halfThick);
      ctx.moveTo(openEndX, -halfThick);
      ctx.lineTo(openEndX, halfThick);
      const lineOff = halfThick * 0.35;
      ctx.moveTo(openStartX, -lineOff);
      ctx.lineTo(openEndX, -lineOff);
      ctx.moveTo(openStartX, lineOff);
      ctx.lineTo(openEndX, lineOff);
      ctx.stroke();
      break;
    }
  }
}
