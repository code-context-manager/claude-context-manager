import { X } from 'lucide-react'
import { useStore } from '../../store'

export function Toast() {
  const toast = useStore((s) => s.toast)
  const dismissToast = useStore((s) => s.dismissToast)

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-2.5 rounded-lg border border-edge-strong bg-surface-overlay shadow-overlay flex items-center gap-3 animate-[fadeIn_120ms_ease-out]"
    >
      <span className="text-sm text-content-primary">{toast.message}</span>
      <button
        onClick={dismissToast}
        className="text-content-muted hover:text-content-primary transition-colors"
        title="Dismiss"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}
