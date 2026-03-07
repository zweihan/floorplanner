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
    userLayerId: null,
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

    case 'cabinet': {
      // Cabinet body
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Door face inset (front edge, 15% of depth)
      ctx.fillStyle = darken(fillColor, 0.06);
      ctx.fillRect(-hw, hd * 0.85, hw * 2, hd * 0.15);
      ctx.strokeRect(-hw, hd * 0.85, hw * 2, hd * 0.15);
      // Centre divider line (two doors)
      ctx.beginPath();
      ctx.moveTo(0, -hd);
      ctx.lineTo(0, hd * 0.85);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      break;
    }

    case 'shower': {
      // Enclosure body
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Quarter-circle door arc in top-left corner (pivot door symbol)
      const arcR = Math.min(hw, hd) * 0.55;
      ctx.beginPath();
      ctx.arc(-hw, -hd, arcR, 0, Math.PI / 2);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Door leaf line (from corner along the arc radius)
      ctx.beginPath();
      ctx.moveTo(-hw, -hd);
      ctx.lineTo(-hw + arcR, -hd);
      ctx.stroke();
      // Drain circle in centre
      const dr = Math.min(hw, hd) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, dr, 0, Math.PI * 2);
      ctx.fillStyle = darken(fillColor, 0.2);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      break;
    }

    case 'showerhead': {
      const r = Math.min(hw, hd);
      // Spray coverage circle (dashed)
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.setLineDash([]);
      // Head disc
      const hr = r * 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, hr, 0, Math.PI * 2);
      ctx.fillStyle = darken(fillColor, 0.18);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Radiating spray lines (8 lines from edge of head to coverage ring)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * hr, Math.sin(a) * hr);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
      break;
    }

    case 'switch': {
      const r = Math.min(hw, hd) * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Diagonal line (switch lever)
      ctx.beginPath();
      ctx.moveTo(-r * 0.5,  r * 0.5);
      ctx.lineTo( r * 0.5, -r * 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
      // Dot at tip
      ctx.beginPath();
      ctx.arc(r * 0.5, -r * 0.5, r * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
      break;
    }

    case 'pipe-supply': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Right-pointing arrow along centreline
      const tipX = hw * 0.65;
      const tailX = -hw * 0.5;
      const arrowHalfH = hd * 0.55;
      ctx.fillStyle = darken(fillColor, 0.25);
      ctx.strokeStyle = strokeColor;
      // Shaft
      ctx.beginPath();
      ctx.moveTo(tailX, 0);
      ctx.lineTo(tipX - arrowHalfH, 0);
      ctx.lineWidth = Math.max(1, hd * 0.3);
      ctx.stroke();
      ctx.lineWidth = 1;
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(tipX, 0);
      ctx.lineTo(tipX - arrowHalfH, -arrowHalfH);
      ctx.lineTo(tipX - arrowHalfH,  arrowHalfH);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'pipe-drain': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      // Dashed outline
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      ctx.setLineDash([]);
      // Left-pointing arrow
      const tipX = -hw * 0.65;
      const tailX = hw * 0.5;
      const arrowHalfH = hd * 0.55;
      ctx.fillStyle = darken(fillColor, 0.25);
      ctx.beginPath();
      ctx.moveTo(tipX, 0);
      ctx.lineTo(tipX + arrowHalfH, -arrowHalfH);
      ctx.lineTo(tipX + arrowHalfH,  arrowHalfH);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX, 0);
      ctx.lineTo(tipX + arrowHalfH, 0);
      ctx.lineWidth = Math.max(1, hd * 0.3);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.lineWidth = 1;
      break;
    }

    case 'valve': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Bowtie — two filled triangles tip-to-tip
      ctx.fillStyle = darken(fillColor, 0.15);
      // Left triangle
      ctx.beginPath();
      ctx.moveTo(-hw * 0.9, -hd * 0.8);
      ctx.lineTo(-hw * 0.9,  hd * 0.8);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // Right triangle
      ctx.beginPath();
      ctx.moveTo(hw * 0.9, -hd * 0.8);
      ctx.lineTo(hw * 0.9,  hd * 0.8);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'ac-indoor': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // 3 airflow slot lines at 25%, 50%, 75% of height
      for (const t of [0.25, 0.5, 0.75]) {
        const y = -hd + t * hd * 2;
        ctx.beginPath();
        ctx.moveTo(-hw + hw * 0.35, y);
        ctx.lineTo(hw - 2, y);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // Fan arc at left end
      ctx.beginPath();
      ctx.arc(-hw * 0.65, 0, hd * 0.6, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    }

    case 'ac-duct': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Diagonal hatching (45°), clipped to rect
      ctx.save();
      ctx.beginPath();
      ctx.rect(-hw, -hd, hw * 2, hd * 2);
      ctx.clip();
      const spacing = Math.max(hd * 0.9, 4);
      ctx.lineWidth = 0.75;
      for (let x = -hw * 2; x < hw * 2; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, -hd);
        ctx.lineTo(x + hd * 2, hd);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case 'ac-drain': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      ctx.setLineDash([]);
      // 5 dots along centreline
      const dotR = Math.min(hd * 0.25, 3);
      ctx.fillStyle = strokeColor;
      for (let i = 0; i < 5; i++) {
        const x = -hw * 0.7 + (i / 4) * hw * 1.4;
        ctx.beginPath();
        ctx.arc(x, 0, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'lamp': {
      // Background rect
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      const r = Math.min(hw, hd);
      // Centre disc
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = darken(fillColor, 0.1);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      // 8 radiating lines
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;
    }

    case 'outlet': {
      ctx.fillStyle = fillColor;
      ctx.fillRect(-hw, -hd, hw * 2, hd * 2);
      ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
      // Two socket slots
      const sw = hw * 0.18;
      const sh = hd * 0.4;
      ctx.fillStyle = strokeColor;
      ctx.fillRect(-hw * 0.4 - sw / 2, -sh, sw, sh * 2);
      ctx.fillRect( hw * 0.4 - sw / 2, -sh, sw, sh * 2);
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
