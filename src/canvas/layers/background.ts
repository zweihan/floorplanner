import type { UserSettings } from '../../types/settings';

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: UserSettings
): void {
  ctx.fillStyle = settings.theme === 'dark' ? '#1e1e1e' : '#faf9f7';
  ctx.fillRect(0, 0, width, height);
}
