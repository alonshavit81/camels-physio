import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore, type ToastKind } from '../../store/toastStore'
import { cn } from '../../lib/cn'

const STYLES: Record<ToastKind, string> = {
  // green-700: white text needs it for AA contrast (green-600 is only 3.2:1).
  success: 'bg-green-700 text-white',
  error: 'bg-brand-700 text-white',
  info: 'bg-gray-900 text-white',
}

const ICONS: Record<ToastKind, typeof Info> = { success: CheckCircle2, error: XCircle, info: Info }

/**
 * Sticky just below the header, and below any banner shown under it (the
 * wrapper sits in flow, with zero height so the page never shifts); when the
 * page is scrolled it stays pinned under the header, so it is visible even
 * with the keyboard open. The live region is the always-mounted wrapper:
 * screen readers only announce content that changes inside an existing
 * region, not a region inserted with its text. Tapping anywhere on a toast
 * dismisses it; the inner button is the keyboard / VoiceOver path.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none sticky z-50 mx-auto flex h-0 min-h-0 w-full max-w-md flex-col gap-2 px-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 6.25rem)' }}
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn('pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-left text-base font-medium shadow-lg', STYLES[t.kind])}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
