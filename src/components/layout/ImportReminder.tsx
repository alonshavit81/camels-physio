import { CloudDownload } from 'lucide-react'
import { Button } from '../ui/Button'
import { todayKey } from '../../lib/dates'
import { needsImportReminder } from '../../lib/sync'
import { useAppStore } from '../../store/useAppStore'

/**
 * "You may be behind": shown under the header when this phone has activity newer
 * than its last sync with the group. Import opens Start Training; Not now
 * silences it for the rest of the day. A labelled landmark, not a live region:
 * it is persistent, part of the first paint, and holds buttons.
 */
export function ImportReminder({ onImport }: { onImport: () => void }) {
  const today = todayKey()
  const show = useAppStore((s) => needsImportReminder(s, today))
  const dismiss = useAppStore((s) => s.dismissImportReminder)
  if (!show) return null
  return (
    <section aria-label="Import reminder" className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
      <div className="mx-auto flex max-w-lg flex-wrap items-center gap-2">
        <CloudDownload className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 basis-52">You may be behind. Import the latest file from the WhatsApp group?</span>
        <div className="flex gap-1">
          <Button size="sm" onClick={onImport}>
            Import now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dismiss(today)}>
            Not now
          </Button>
        </div>
      </div>
    </section>
  )
}
