import { TriangleAlert } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

/** Shown when localStorage is unavailable (private mode, quota, blocked). */
export function StorageBanner() {
  const healthy = useAppStore((s) => s.storageHealthy)
  if (healthy) return null
  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-lg items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>This device is not saving data (private browsing or storage blocked). Export a backup after each session.</span>
      </div>
    </div>
  )
}
