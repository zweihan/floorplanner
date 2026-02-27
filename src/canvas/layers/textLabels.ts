import type { TextLabel, Viewport } from '../../types/plan';
import { worldToScreen } from '../../geometry/transforms';

export function drawTextLabels(
  ctx: CanvasRenderingContext2D,
  labels: TextLabel[],
  viewport: Viewport,
  ppcm: number,
  editingId: string | null
): void {
  if (labels.length === 0) return;
  ctx.save();

  for (const label of labels) {
    if (label.id === editingId) continue; // skip the label being edited (overlay handles it)

    const s = worldToScreen(label.position.x, label.position.y, viewport, ppcm);
    const fontSizePx = Math.max(8, label.fontSize * ppcm * viewport.zoom);

    ctx.font = `${fontSizePx}px system-ui, sans-serif`;
    ctx.fillStyle = label.color;
    ctx.textAlign = label.align;
    ctx.textBaseline = 'top';

    // Multi-line support: split on newlines
    const lines = label.text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, s.x, s.y + i * fontSizePx * 1.2);
    });
  }

  ctx.restore();
}
