import { useStore } from '../store';

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  info:    { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  error:   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
};

export function ToastContainer() {
  const toasts = useStore(s => s.toasts);
  const dismissToast = useStore(s => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      style={{ pointerEvents: 'none' }}
    >
      {toasts.map(toast => {
        const style = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info;
        return (
          <div
            key={toast.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm max-w-xs"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: style.text,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={() => dismissToast(toast.id)}
            role="alert"
          >
            <span className="flex-1">{toast.message}</span>
            <span className="text-xs opacity-60 shrink-0">✕</span>
          </div>
        );
      })}
    </div>
  );
}
