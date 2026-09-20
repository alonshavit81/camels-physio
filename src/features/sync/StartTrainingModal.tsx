import { useEffect, useState, type ChangeEvent } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { parseBackupText } from '../../lib/backup'
import { readFileText } from '../../lib/backupFile'
import { formatStamp } from '../../lib/dates'
import { userName } from '../../lib/users'
import type { MergeSummary, UserId } from '../../lib/types'
import { useAppStore } from '../../store/useAppStore'

type ImportOutcome =
  | { ok: true; fileName: string; summary: MergeSummary; skipped: number; exportedAt: string; exportedBy: UserId | null }
  | { ok: false; fileName: string; message: string }

const FILE_INPUT_ID = 'backup-file-input'

/**
 * "Start Training": import a backup shared in the WhatsApp group.
 * The <input type="file"> is a real, visible element rendered by React inside
 * the open sheet (never created on the fly and clicked programmatically), which
 * is what makes it reliable on iPhone Safari.
 */
export function StartTrainingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importData = useAppStore((s) => s.importData)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)

  useEffect(() => {
    if (!open) {
      setOutcome(null)
      setBusy(false)
    }
  }, [open])

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    // Reset first so choosing the same file again fires another change event.
    input.value = ''
    if (!file) return
    setBusy(true)
    setOutcome(null)
    try {
      const text = await readFileText(file)
      const parsed = parseBackupText(text)
      if (!parsed.ok) {
        setOutcome({ ok: false, fileName: file.name, message: parsed.error })
        return
      }
      const summary = importData(parsed.envelope, 'newest', file.name)
      // No toast here: the sheet stays open (a toast would sit inert behind the
      // dialog backdrop) and the summary below already says what happened.
      setOutcome({
        ok: true,
        fileName: file.name,
        summary,
        skipped: parsed.skipped,
        exportedAt: parsed.envelope.exportedAt,
        exportedBy: parsed.envelope.exportedBy,
      })
    } catch (err) {
      setOutcome({ ok: false, fileName: file.name, message: err instanceof Error ? err.message : 'Could not read the file.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="🏃 Start Training">
      <div role="note" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900">
        <ol className="list-decimal space-y-1 pl-5 text-base">
          <li>Good you are here, upload previous trainings here.</li>
          <li>Make sure you have enough tape.</li>
          <li>Treat people by priority!</li>
        </ol>
      </div>

      <label htmlFor={FILE_INPUT_ID} className="mt-5 block text-sm font-semibold text-gray-700">
        Backup file (.json)
      </label>
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept="application/json,text/plain,.json,.txt"
        disabled={busy}
        onChange={onFileChange}
        className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white p-1.5 text-base text-gray-600 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:text-base file:font-semibold file:text-white disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-gray-500">
        Pick the latest file from the WhatsApp group (save it to Files first). It is merged into this phone: newer edits win and nothing is lost.
      </p>

      {/* One live region for the whole life of the sheet: only text that changes inside an existing region is announced. */}
      <div role="status" aria-live="polite">
        {busy && (
          <p className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Importing…
          </p>
        )}
        {outcome?.ok && <ImportSuccess outcome={outcome} />}
      </div>
      {outcome && !outcome.ok && <ImportError outcome={outcome} />}
    </Modal>
  )
}

function ImportError({ outcome }: { outcome: Extract<ImportOutcome, { ok: false }> }) {
  return (
    <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Could not import {outcome.fileName}</p>
        <p>{outcome.message}</p>
        <p className="mt-1 text-xs text-red-800">Nothing on this phone was changed.</p>
      </div>
    </div>
  )
}

const ROWS: Array<{ key: Exclude<keyof MergeSummary, 'skippedInvalid'>; label: string }> = [
  { key: 'players', label: 'Players' },
  { key: 'teamEvents', label: 'Team events' },
  { key: 'workDays', label: 'Work days' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'attendanceEntries', label: 'Attendance marks' },
  { key: 'injuries', label: 'Injuries' },
]

function countChanges(summary: MergeSummary): number {
  return ROWS.reduce((n, r) => n + summary[r.key].added + summary[r.key].updated, 0)
}

function ImportSuccess({ outcome }: { outcome: Extract<ImportOutcome, { ok: true }> }) {
  const { summary } = outcome
  const totalNew = countChanges(summary)
  return (
    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
      <p className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        {totalNew === 0 ? 'Already up to date' : `Merged ${totalNew} change${totalNew === 1 ? '' : 's'}`}
      </p>
      <p className="mt-1 text-xs text-green-800">
        {outcome.fileName}
        {outcome.exportedAt ? ` · exported ${formatStamp(outcome.exportedAt)}` : ''}
        {outcome.exportedBy ? ` by ${userName(outcome.exportedBy)}` : ''}
      </p>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-green-800">
            <th className="py-1 font-semibold">Records</th>
            <th className="py-1 text-right font-semibold">New</th>
            <th className="py-1 text-right font-semibold">Updated</th>
            <th className="py-1 text-right font-semibold">Same</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} className="border-t border-green-200/70">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{summary[r.key].added}</td>
              <td className="py-1 text-right tabular-nums">{summary[r.key].updated}</td>
              <td className="py-1 text-right tabular-nums">{summary[r.key].unchanged}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(outcome.skipped > 0 || summary.skippedInvalid > 0) && (
        <p className="mt-2 text-xs text-amber-800">
          {outcome.skipped + summary.skippedInvalid} invalid record(s) in the file were skipped.
        </p>
      )}
    </div>
  )
}
