import type { FurnitureItem, Viewport } from '../../types/plan';
import type { UserSettings } from '../../types/settings';
import type { FurnitureTemplate } from '../../data/furnitureTemplates';
import { worldToScreen } from '../../geometry/transforms';

// ─── Public functions ────────────────────────────────────────────────────────

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  items: FurnitureItem[],
  viewport: Viewport,
  settings: UserSettings,
  ppcm: number
): void {
  for (const item of items) {
    _drawItem(ctx, item, viewport, ppcm, settings.theme === 'dark', 1.0);
  }
}

/** Semi-transparent ghost shown while placing furniture. */
export function drawFurnitureGhost(
  ctx: CanvasRenderingContext2D,
  template: FurnitureTemplate,
  position: { x: number; y: number },
  viewport: Viewport,
  ppcm: number
): void {
  const ghostItem: FurnitureItem = {
    id: '__ghost__',
    templateId: template.id,
    label: template.label,
    position,
    width: template.defaultWidth,
    depth: template.defaultDepth,
    rotation: 0,
    color: template.defaultColor,
    locked: false,
  };
  _drawItem(ctx, ghostItem, viewport, ppcm, false, 0.45);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function _drawItem(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  viewport: Viewport,
  ppcm: number,
  isDark: boolean,
  alpha: number
): void {
  const sc = worldToScreen(item.position.x, item.position.y, viewport, ppcm);
  const hw = (item.width / 2) * ppcm * viewport.zoom;
  const hd = (item.depth / 2) * ppcm * viewport.zoom;
  const rotRad = item.rotation * Math.PI / 180;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sc.x, sc.y);
  ctx.rotate(rotRad);

  const strokeColor = isDark ? '#888888' : '#555555';

  _drawShape(ctx, item.templateId, hw, hd, item.color, strokeColor, isDark);

  ctx.restore();
}

/**
 * Draws the furniture symbol in local coordinates.
 * Origin is at item centre. x-axis = width, y-axis = depth.
 */
function _drawShape(
  ctx: CanvasRenderingContext2D,
  templateId: string,
  hw: number,
  hd: number,
  fillColor: string,
  strokeColor: string,
  _isDark: boolean
): void {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;

  switch (templateId) {
    case 'sofa': {
      // Seat cushions area
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Back panel (top edge)
      ctx.fillStyle = darken(fillColor, 0.15);
      ctx.fillRect(-hw, -hd, hw * 2, hd * 0.35);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 0.35);
      // Armrests (left and right)
      ctx.fillRect(-hw, -hd + hd * 0.35, hw * 0.18, hd * 1.3);
      ctx.strokeRect(-hw, -hd + hd * 0.35, hw * 0.18, hd * 1.3);
      ctx.fillRect(hw - hw * 0.18, -hd + hd * 0.35, hw * 0.18, hd * 1.3);
      ctx.strokeRect(hw - hw * 0.18, -hd + hd * 0.35, hw * 0.18, hd * 1.3);
      break;
    }

    case 'bed': {
      // Bed frame
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Headboard (top)
      ctx.fillStyle = darken(fillColor, 0.12);
      ctx.fillRect(-hw, -hd, hw * 2, hd * 0.2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 0.2);
      // Pillows
      const pw = hw * 0.38;
      const ph = hd * 0.14;
      const py = -hd + hd * 0.24;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(-hw * 0.35, py, pw, ph, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hw * 0.35, py, pw, ph, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Sheet line
      ctx.beginPath();
      ctx.moveTo(-hw + 2, -hd + hd * 0.42);
      ctx.lineTo(hw - 2, -hd + hd * 0.42);
      ctx.stroke();
      break;
    }

    case 'table': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Oval inset
      ctx.beginPath();
      ctx.ellipse(0, 0, hw * 0.75, hd * 0.75, 0, 0, Math.PI * 2);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      break;
    }

    case 'chair': {
      // Seat
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd * 0.35, hw * 2, hd * 1.35);
      ctx.strokeRect(-hw, -hd * 0.35, hw * 2, hd * 1.35);
      // Backrest (top arc)
      ctx.fillStyle = darken(fillColor, 0.1);
      ctx.beginPath();
      ctx.arc(0, -hd * 0.35, hw, 0, Math.PI, true);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'desk': {
      // Main surface
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Return (L-shape corner piece)
      ctx.fillStyle = darken(fillColor, 0.08);
      ctx.fillRect(-hw, -hd, hw * 0.4, hd * 0.5);
      ctx.strokeRect(-hw, -hd, hw * 0.4, hd * 0.5);
      break;
    }

    case 'toilet': {
      // Tank (top rectangle)
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 0.38);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 0.38);
      // Bowl (oval)
      ctx.beginPath();
      ctx.ellipse(0, -hd + hd * 0.38 + hd * 0.65, hw * 0.9, hd * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f0f4f8';
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'bathtub': {
      // Tub outline
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Inner oval (basin)
      ctx.beginPath();
      ctx.ellipse(0, hd * 0.08, hw * 0.72, hd * 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d8edf8';
      ctx.fill();
      ctx.stroke();
      // Drain dot
      ctx.beginPath();
      ctx.arc(0, hd * 0.6, Math.min(hw, hd) * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      break;
    }

    case 'sink': {
      // Outer frame
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Basin (circle)
      const r = Math.min(hw, hd) * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#d8edf8';
      ctx.fill();
      ctx.stroke();
      // Drain
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      break;
    }

    case 'stove': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // 4 burners
      const bx = hw * 0.45;
      const by = hd * 0.45;
      const br = Math.min(hw, hd) * 0.25;
      for (const [cx, cy] of [[-bx, -by], [bx, -by], [-bx, by], [bx, by]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, br, 0, Math.PI * 2);
        ctx.strokeStyle = darken(fillColor, 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, br * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = darken(fillColor, 0.2);
        ctx.fill();
      }
      break;
    }

    case 'fridge': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Freezer partition
      ctx.beginPath();
      ctx.moveTo(-hw + 2, -hd + hd * 0.35);
      ctx.lineTo(hw - 2, -hd + hd * 0.35);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Handle lines
      for (const y of [-hd * 0.55, hd * 0.3]) {
        ctx.beginPath();
        ctx.moveTo(hw * 0.5, y);
        ctx.lineTo(hw * 0.8, y);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      break;
    }

    default: {
      // Generic rectangle
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      break;
    }
  }
}

/** Darkens a hex colour by `amount` (0–1). */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amount));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
