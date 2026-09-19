import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'
import { parsePlayerNumber } from './playerNumber'

interface Errors {
  name?: string
  number?: string
}

const FORM_ID = 'add-player-form'
const NAME_ID = 'add-player-name'
const NUMBER_ID = 'add-player-number'

/** Bottom sheet for adding a manual player. On save it navigates to the new profile. */
export function AddPlayerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addPlayer = useAppStore((s) => s.addPlayer)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const formRef = useRef<HTMLFormElement>(null)

  function focusField(id: string) {
    formRef.current?.querySelector<HTMLInputElement>(`#${id}`)?.focus()
  }

  // Start from a blank form every time the sheet opens. Focus is set here
  // rather than with autoFocus: React focuses during commit, while the
  // <dialog> only opens in the Modal's (child) effect, which runs before this one.
  useEffect(() => {
    if (!open) return
    setName('')
    setNumber('')
    setErrors({})
    focusField(NAME_ID)
  }, [open])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const trimmed = name.trim()
    if (!trimmed) next.name = 'Name is required.'
    const parsed = parsePlayerNumber(number)
    if (!parsed.ok) next.number = parsed.error
    if (next.name || next.number || !parsed.ok) {
      setErrors(next)
      return
    }
    const id = addPlayer({ name: trimmed, number: parsed.value })
    if (!id) {
      setErrors({ name: 'Could not add the player.' })
      return
    }
    toast.success('Player added')
    onClose()
    navigate(`/players/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add player"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} className="flex-[2]">
            Save
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" htmlFor={NAME_ID}>
          <Input
            id={NAME_ID}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (errors.name) setErrors((er) => ({ ...er, name: undefined }))
            }}
            onKeyDown={(e) => {
              // The key is labelled "next": move to Number instead of submitting.
              if (e.key === 'Enter') {
                e.preventDefault()
                focusField(NUMBER_ID)
              }
            }}
            placeholder="Player name"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'add-player-name-error' : undefined}
          />
          {errors.name && (
            <p id="add-player-name-error" role="alert" className="text-sm font-medium text-brand-700">
              {errors.name}
            </p>
          )}
        </Field>
        <Field label="Number" htmlFor={NUMBER_ID} hint="Optional jersey number, 0–999.">
          <Input
            id={NUMBER_ID}
            value={number}
            onChange={(e) => {
              setNumber(e.target.value)
              if (errors.number) setErrors((er) => ({ ...er, number: undefined }))
            }}
            placeholder="e.g. 7"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={errors.number ? 'add-player-number-error' : undefined}
          />
          {errors.number && (
            <p id="add-player-number-error" role="alert" className="text-sm font-medium text-brand-700">
              {errors.number}
            </p>
          )}
        </Field>
      </form>
    </Modal>
  )
}
