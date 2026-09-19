import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl, type SegmentOption } from '../../components/ui/SegmentedControl'
import { isDateKey } from '../../lib/dates'
import {
  BODY_PARTS,
  INJURY_STATUSES,
  SEVERITIES,
  type BodyPart,
  type DateKey,
  type Injury,
  type InjuryStatus,
  type Severity,
  type Side,
} from '../../lib/types'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'
import { playerById, playerLabel } from '../../store/selectors'

export interface InjuryFormModalProps {
  open: boolean
  onClose: () => void
  playerId: string
  /** Session the report belongs to; null when added from the player profile. */
  sessionId: string | null
  /** Pre-filled date for a new report (the session date, or today). */
  defaultDate: DateKey
  /** When set, the form edits this injury instead of creating one. */
  injury?: Injury
}

type SideChoice = Exclude<Side, null> | 'none'

const BODY_PART_ID = 'injury-body-part'

const SIDE_OPTIONS: ReadonlyArray<SegmentOption<SideChoice>> = [
  {
    value: 'none',
    label: (
      <>
        <span aria-hidden="true">–</span>
        <span className="sr-only">No side</span>
      </>
    ),
    title: 'No side',
  },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

/**
 * Bottom-sheet form for reporting or editing an injury. Saving writes to the
 * single injuries collection, so the player's profile "Injury log" and the
 * injury statistics update automatically.
 */
export function InjuryFormModal({ open, onClose, playerId, sessionId, defaultDate, injury }: InjuryFormModalProps) {
  const player = useAppStore((s) => playerById(s.players, playerId))
  const addInjury = useAppStore((s) => s.addInjury)
  const updateInjury = useAppStore((s) => s.updateInjury)

  const [bodyPart, setBodyPart] = useState<BodyPart | ''>('')
  const [side, setSide] = useState<SideChoice>('none')
  const [severity, setSeverity] = useState<Severity>('Medium')
  const [status, setStatus] = useState<InjuryStatus>('Active')
  const [date, setDate] = useState<DateKey>(defaultDate)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset the draft every time the sheet opens (for a new report or a different injury).
  // Focus is set here rather than with autoFocus: React focuses during commit,
  // while the <dialog> only opens in the Modal's (child) effect, which runs before this one.
  useEffect(() => {
    if (!open) return
    setBodyPart(injury?.bodyPart ?? '')
    setSide(injury?.side ?? 'none')
    setSeverity(injury?.severity ?? 'Medium')
    setStatus(injury?.status ?? 'Active')
    setDate(injury?.date ?? defaultDate)
    setDescription(injury?.description ?? '')
    setError(null)
    if (!injury) document.getElementById(BODY_PART_ID)?.focus()
  }, [open, injury, defaultDate])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!bodyPart) {
      setError('Choose the injured body part.')
      return
    }
    if (!isDateKey(date)) {
      setError('Enter a valid date.')
      return
    }
    const fields = { bodyPart, side: side === 'none' ? null : side, severity, status, date, description: description.trim() }
    if (injury) {
      updateInjury(injury.id, fields)
      toast.success('Injury updated')
    } else {
      const id = addInjury({ playerId, sessionId, ...fields })
      if (!id) {
        setError('Could not save the injury.')
        return
      }
      toast.success(`Injury added to ${playerLabel(player)}`)
    }
    onClose()
  }

  const formId = 'injury-form'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={injury ? 'Edit injury' : `Report injury · ${player ? playerLabel(player) : 'Player'}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form={formId} className="flex-[2]">
            {injury ? 'Save changes' : 'Save injury'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Body part" htmlFor={BODY_PART_ID}>
          <Select
            id={BODY_PART_ID}
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value as BodyPart | '')}
            placeholder="Select body part"
            options={BODY_PARTS.map((b) => ({ value: b, label: b }))}
            required
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">Side</span>
          <SegmentedControl ariaLabel="Side" size="sm" options={SIDE_OPTIONS} value={side} onChange={setSide} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">Severity</span>
          <SegmentedControl
            ariaLabel="Severity"
            size="sm"
            options={SEVERITIES.map((s) => ({ value: s, label: s }))}
            value={severity}
            onChange={setSeverity}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">Status</span>
          <SegmentedControl
            ariaLabel="Status"
            size="sm"
            options={INJURY_STATUSES.map((s) => ({ value: s, label: s }))}
            value={status}
            onChange={setStatus}
          />
        </div>
        <Field label="Date" htmlFor="injury-date">
          <Input id="injury-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Description" htmlFor="injury-description" hint="What happened, treatment given, follow-up.">
          <Textarea id="injury-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="e.g. Twisted on landing, iced and taped" />
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-brand-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
