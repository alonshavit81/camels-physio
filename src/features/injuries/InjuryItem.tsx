import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { formatDateShort } from '../../lib/dates'
import type { Injury } from '../../lib/types'
import { userName } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'
import { InjuryStatusBadge, SeverityBadge, injuryTitle } from './badges'

/**
 * One injury in a list (player profile or session roster). Offers a quick
 * status flip, edit (via the parent's form) and a two-tap delete (no window.confirm).
 */
export function InjuryItem({ injury, onEdit, showSessionLink = false }: { injury: Injury; onEdit?: () => void; showSessionLink?: boolean }) {
  const updateInjury = useAppStore((s) => s.updateInjury)
  const deleteInjury = useAppStore((s) => s.deleteInjury)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!confirmDelete) return
    const t = window.setTimeout(() => setConfirmDelete(false), 4000)
    return () => window.clearTimeout(t)
  }, [confirmDelete])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900">{injuryTitle(injury.bodyPart, injury.side)}</span>
        <SeverityBadge severity={injury.severity} />
        <InjuryStatusBadge status={injury.status} />
        <span className="ml-auto text-xs text-gray-500">{formatDateShort(injury.date)}</span>
      </div>
      {injury.description && (
        <p dir="auto" className="mt-1.5 text-sm text-gray-700 whitespace-pre-line [unicode-bidi:plaintext]">
          {injury.description}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Reported by {userName(injury.reportedBy)}
        {showSessionLink && injury.sessionId && (
          <>
            {' · '}
            <Link to={`/sessions/${injury.sessionId}`} className="-mx-2 -my-3 inline-flex min-h-11 items-center px-2 font-medium text-brand-700 underline-offset-2 hover:underline">
              View session
            </Link>
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            updateInjury(injury.id, { status: injury.status === 'Active' ? 'Recovered' : 'Active' })
            toast.success(injury.status === 'Active' ? 'Marked as recovered' : 'Marked as active')
          }}
        >
          {injury.status === 'Active' ? 'Mark recovered' : 'Mark active'}
        </Button>
        {onEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit injury">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
          </Button>
        )}
        <Button
          size="sm"
          variant={confirmDelete ? 'danger' : 'ghost'}
          className="ml-auto"
          aria-label={confirmDelete ? 'Confirm delete injury' : 'Delete injury'}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              return
            }
            deleteInjury(injury.id)
            toast.info('Injury deleted')
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> {confirmDelete ? 'Tap again to delete' : 'Delete'}
        </Button>
      </div>
    </div>
  )
}
