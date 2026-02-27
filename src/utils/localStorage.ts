export const STORAGE_KEYS = {
  settings: 'floorplanner:settings',
  plans: 'floorplanner:plans',
  activePlanId: 'floorplanner:activePlanId',
} as const;

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw e; // caller should handle via addToast
    }
  }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
