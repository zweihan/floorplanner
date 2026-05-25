import type { UserLayer } from '../types/plan';

/**
 * Returns true when the item's user layer is visible (or the item has no layer assigned).
 * Items with userLayerId === null belong to the implicit Default layer, which is always visible
 * unless the explicit 'default' entry in userLayers has visible: false.
 */
export function isUserLayerVisible(
  layerId: string | null | undefined,
  userLayers: UserLayer[]
): boolean {
  if (!layerId) {
    // null / undefined → Default layer
    const defaultLayer = userLayers.find(l => l.id === 'default');
    return defaultLayer ? defaultLayer.visible : true;
  }
  const layer = userLayers.find(l => l.id === layerId);
  return layer ? layer.visible : true; // unknown id → show by default
}
