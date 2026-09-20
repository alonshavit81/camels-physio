import { useEffect, useMemo, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { backupFilename, serializeExport } from '../../lib/backup'
import { canShareFiles, downloadBackup, isStandaloneDisplay, shareBackup, type DownloadOutcome } from '../../lib/backupFile'
import { cn } from '../../lib/cn'
import { formatMonthTitle, currentMonthKey } from '../../lib/dates'
import type { ApplyResult } from '../../lib/types'
import { userName } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'
import { liveInjuries } from '../../store/selectors'

/** Non-success outcomes (cancelled, preview, retry) are amber so the colour never contradicts the text. */
interface Message {
  tone: 'success' | 'warning'
  text: string
}

const TONE_CLASS: Record<Message['tone'], string> = {
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
}

const DOWNLOAD_MESSAGES: Record<DownloadOutcome, Message> = {
  downloaded: {
    tone: 'success',
    text: 'Download started. On iPhone it lands in Files › Downloads; share it from there to the WhatsApp group.',
  },
  opened: {
    tone: 'success',
    text: 'Opened in a new tab. Tap the Share icon there and choose "Save to Files", then send it to the WhatsApp group.',
  },
  'standalone-preview': {
    tone: 'warning',
    text: 'iOS may show the file in a preview: tap the Share icon there and choose "Save to Files", then send it to the WhatsApp group. If nothing opened, open the site in Safari and use Download JSON there.',
  },
  'data-uri': {
    tone: 'warning',
    text: 'The file may have opened as a preview: tap the Share icon there and choose "Save to Files", then send it to the WhatsApp group. If nothing opened, try again from Safari.',
  },
}

/** "End Training": export this phone's data as a JSON backup for the WhatsApp group. */
export function EndTrainingModal({ open, onClose, applyResult = null }: { open: boolean; onClose: () => void; applyResult?: ApplyResult | null }) {
  const exportSnapshot = useAppStore((s) => s.exportSnapshot)
  const markExported = useAppStore((s) => s.markExported)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const playerCount = useAppStore((s) => Object.values(s.players).filter((p) => !p.deleted).length)
  const sessionCount = useAppStore((s) => Object.keys(s.sessions).length)
  const injuryCount = useAppStore((s) => liveInjuries(s.injuries).length)
  const [message, setMessage] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  // State, not memo: a TypeError from navigator.share() proves files cannot be shared after all.
  const [shareSupported, setShareSupported] = useState(() => canShareFiles())
  const standalone = useMemo(() => isStandaloneDisplay(), [])
  // In the Home-Screen app a download only opens a preview that is hard to leave, so Share is the sole path there.
  const showDownload = !(standalone && shareSupported)

  useEffect(() => {
    if (!open) {
      setMessage(null)
      setBusy(false)
    }
  }, [open])

  function buildPayload() {
    const envelope = exportSnapshot()
    return { json: serializeExport(envelope), name: backupFilename(new Date(), userName(currentUserId)) }
  }

  function doDownload() {
    const { json, name } = buildPayload()
    const outcome = downloadBackup(json, name)
    const m = DOWNLOAD_MESSAGES[outcome]
    // Only a real download / new tab has a saved file worth naming; a preview may not have saved anything.
    const saved = outcome === 'downloaded' || outcome === 'opened'
    if (saved) markExported()
    setMessage(saved ? { ...m, text: `${m.text} (${name})` } : m)
  }

  async function doShare() {
    // Everything up to navigator.share() runs synchronously inside the tap, keeping the user activation.
    const { json, name } = buildPayload()
    setBusy(true)
    try {
      const outcome = await shareBackup(json, name)
      if (outcome === 'shared') {
        markExported()
        setMessage({ tone: 'success', text: `Shared ${name}. Make sure it reached the WhatsApp group.` })
      }
      else if (outcome === 'cancelled') setMessage({ tone: 'warning', text: 'Share cancelled. Nothing was sent.' })
      else if (outcome === 'failed')
        setMessage({
          tone: 'warning',
          text: standalone
            ? 'The share sheet did not open. Tap Share again; if it keeps failing, close and reopen the app.'
            : 'The share sheet did not open. Tap Share again, or use Download JSON.',
        })
      else {
        // The user gesture is gone after the await, so never start a download from
        // here (in a tab it is an unexpected prompt, in the Home-Screen app a preview
        // trap): show the Download button instead and let the user tap it.
        setShareSupported(false)
        setMessage({ tone: 'warning', text: 'Sharing is not available here. Tap Download JSON instead.' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="🏁 End Training">
      <div role="note" className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
        <ol className="list-decimal space-y-1 pl-5 text-base">
          <li>Ensure tapes are in the bag for next time (order if missing).</li>
          <li>Report severe injuries in the group immediately.</li>
          <li>Hide the bag in its place.</li>
          <li>Don't forget to share the JSON file in the WhatsApp group.</li>
        </ol>
      </div>

      {applyResult && <ApplySummary result={applyResult} />}

      <div className="mt-5 flex flex-col gap-3">
        {shareSupported && (
          <Button full onClick={doShare} disabled={busy}>
            <Share2 className="h-5 w-5" aria-hidden="true" />
            Share JSON to WhatsApp
          </Button>
        )}
        {showDownload && (
          <Button full variant={shareSupported ? 'secondary' : 'primary'} onClick={doDownload} disabled={busy}>
            <Download className="h-5 w-5" aria-hidden="true" />
            Download JSON
          </Button>
        )}
        {standalone && showDownload && (
          <p className="text-xs text-gray-500">
            In the Home Screen app a download may open as a preview: tap the Share icon there and choose <strong>Save to Files</strong>.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Backup contains {playerCount} players, {sessionCount} sessions and {injuryCount} injuries (UTF-8 JSON, Hebrew text safe).
      </p>

      {/* Always mounted: a live region only announces text that changes inside it, not a region inserted with its text. */}
      <p role="status" aria-live="polite" className={message ? cn('mt-4 rounded-xl border p-3 text-sm', TONE_CLASS[message.tone]) : 'sr-only'}>
        {message?.text ?? ''}
      </p>
    </Modal>
  )
}

/** What the automatic "Apply Monthly Attendance" did when 🏁 was tapped. */
function ApplySummary({ result }: { result: ApplyResult }) {
  const month = formatMonthTitle(currentMonthKey())
  const total = result.created + result.updated + result.unchanged + result.pruned
  if (total === 0) return null
  const parts: string[] = []
  if (result.created) parts.push(`${result.created} new`)
  if (result.updated) parts.push(`${result.updated} refreshed`)
  if (result.pruned) parts.push(`${result.pruned} empty session${result.pruned === 1 ? '' : 's'} removed`)
  return (
    <p className="mt-3 text-sm text-gray-600">
      Sessions for {month} are up to date{parts.length ? ` (${parts.join(', ')})` : ''} and are included in this backup.
    </p>
  )
}
