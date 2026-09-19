import { useCallback, useEffect, useRef, useState } from 'react'
import { Field, Textarea } from '../../components/ui/Field'
import type { Session } from '../../lib/types'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'

/** Typed-but-unsaved notes, tied to the stored version they were typed over. */
interface NotesDraft {
  sessionId: string
  /** `${sessionId}|${notes.updatedAt}` of the stored notes the draft edits. */
  version: string
  text: string
}

function notesVersion(sessionId: string, notes: Session['notes']): string {
  return `${sessionId}|${notes.updatedAt}`
}

/**
 * Session notes textarea with autosave. Blur commits the draft, but blur is not a reliable
 * commit point on iOS (tapping a link/button or closing the keyboard does not blur), so the
 * pending draft is also flushed when the page is left (unmount / session change) and when the
 * tab is hidden (pagehide). Owning the draft here keeps keystrokes from re-rendering the roster.
 */
export function SessionNotes({ sessionId, notes }: { sessionId: string; notes: Session['notes'] }) {
  const updateSessionNotes = useAppStore((s) => s.updateSessionNotes)

  // The local text wins only while it belongs to the current stored version
  // (same session + same updatedAt); any newer stored version (save, import) re-initialises it.
  const version = notesVersion(sessionId, notes)
  const [draft, setDraft] = useState<NotesDraft | null>(null)
  const pendingRef = useRef<NotesDraft | null>(null)
  const text = draft && draft.version === version ? draft.text : notes.text

  function edit(next: string) {
    const d: NotesDraft = { sessionId, version, text: next }
    pendingRef.current = d
    setDraft(d)
  }

  /** Persist the pending draft unless the stored notes moved on underneath it (then it is stale and dropped). */
  const flush = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    const stored = useAppStore.getState().sessions[pending.sessionId]
    if (!stored || notesVersion(stored.id, stored.notes) !== pending.version || stored.notes.text === pending.text) return
    updateSessionNotes(pending.sessionId, pending.text)
    toast.success('Notes saved')
  }, [updateSessionNotes])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [sessionId, flush])

  return (
    <Field label="Session notes" htmlFor="session-notes">
      <Textarea
        id="session-notes"
        rows={3}
        value={text}
        onChange={(e) => edit(e.target.value)}
        onBlur={flush}
        placeholder="Drills, load, who needed treatment…"
      />
    </Field>
  )
}
