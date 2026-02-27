import { useEffect } from 'react';
import { useStore } from '../store';
import { STORAGE_KEYS, saveToStorage } from '../utils/localStorage';

/**
 * Subscribes to plan mutations and persists to localStorage with 500ms debounce.
 * Also saves immediately on page unload.
 * Catches QuotaExceededError and shows a toast.
 */
export function usePlanPersistence(): void {
  const addToast = useStore(s => s.addToast);
  const forceSave = useStore(s => s.forceSave);

  // Save on page unload
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        forceSave();
      } catch {
        // Can't show UI feedback during unload
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [forceSave]);

  // Debounced save on plan changes with QuotaExceededError handling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.plans === prev.plans && state.activePlanId === prev.activePlanId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          saveToStorage(STORAGE_KEYS.plans, state.plans);
          saveToStorage(STORAGE_KEYS.activePlanId, state.activePlanId);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            addToast('Storage full — your plan could not be saved.', 'error', 6000);
          }
        }
      }, 500);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [addToast]);
}
