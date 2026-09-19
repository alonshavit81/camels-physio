import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SEED_EPOCH } from '../../lib/seedPlayers'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { formatStamp } from '../../lib/dates'
import { BODY_TYPES, type BodyType, type Player, type PlayerFields } from '../../lib/types'
import { userName } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'
import { parsePlayerNumber } from './playerNumber'

/** The form's text state: every field as the user typed it. */
interface Draft {
  name: string
  number: string
  fitnessLevel: string
  bodyStructure: string
  bodyType: BodyType
  pastInjuries: string
  rom: string
  strengthening: string
}

interface Errors {
  name?: string
  number?: string
}

function draftFrom(p: Player): Draft {
  return {
    name: p.name,
    number: p.number === null ? '' : String(p.number),
    fitnessLevel: p.fitnessLevel,
    bodyStructure: p.bodyStructure,
    bodyType: p.bodyType,
    pastInjuries: p.pastInjuries,
    rom: p.rom,
    strengthening: p.strengthening,
  }
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.name === b.name &&
    a.number === b.number &&
    a.fitnessLevel === b.fitnessLevel &&
    a.bodyStructure === b.bodyStructure &&
    a.bodyType === b.bodyType &&
    a.pastInjuries === b.pastInjuries &&
    a.rom === b.rom &&
    a.strengthening === b.strengthening
  )
}

/** Normalise the draft into store fields; `fields` is null while the draft is invalid. */
function parseDraft(d: Draft): { fields: PlayerFields | null; errors: Errors } {
  const errors: Errors = {}
  const name = d.name.trim()
  if (!name) errors.name = 'Name is required.'
  const number = parsePlayerNumber(d.number)
  if (!number.ok) errors.number = number.error
  if (errors.name || !number.ok) return { fields: null, errors }
  return {
    fields: {
      name,
      number: number.value,
      fitnessLevel: d.fitnessLevel.trim(),
      bodyStructure: d.bodyStructure.trim(),
      bodyType: d.bodyType,
      pastInjuries: d.pastInjuries.trim(),
      rom: d.rom.trim(),
      strengthening: d.strengthening.trim(),
    },
    errors,
  }
}

function fieldsEqual(f: PlayerFields, p: Player): boolean {
  return (
    f.name === p.name &&
    f.number === p.number &&
    f.fitnessLevel === p.fitnessLevel &&
    f.bodyStructure === p.bodyStructure &&
    f.bodyType === p.bodyType &&
    f.pastInjuries === p.pastInjuries &&
    f.rom === p.rom &&
    f.strengthening === p.strengthening
  )
}

const BODY_TYPE_OPTIONS = BODY_TYPES.map((b) => ({ value: b, label: b }))

/**
 * Profile editor with an explicit Save (blur-autosave misfires when the iOS
 * keyboard closes). Mount it with `key={player.id}` so a different player
 * always starts a fresh draft.
 */
export function PlayerForm({ player }: { player: Player }) {
  const updatePlayer = useAppStore((s) => s.updatePlayer)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(player))

  // If the player changes underneath a clean form (e.g. a backup was imported),
  // follow it; never clobber edits in progress.
  const [prevPlayer, setPrevPlayer] = useState(player)
  if (prevPlayer !== player) {
    setPrevPlayer(player)
    if (draftsEqual(draft, draftFrom(prevPlayer))) setDraft(draftFrom(player))
  }

  const { fields, errors } = parseDraft(draft)
  const dirty = fields ? !fieldsEqual(fields, player) : true
  const canSave = dirty && fields !== null

  // Back / tab navigation is not blocked (no window.confirm), so at least say
  // that edits were dropped. Deleting the player unmounts the form too; that
  // already has its own toast.
  const dirtyOnUnmount = useRef(false)
  useEffect(() => {
    dirtyOnUnmount.current = dirty && !player.deleted
  })
  useEffect(
    () => () => {
      if (dirtyOnUnmount.current) toast.info('Unsaved changes discarded')
    },
    [],
  )

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave || !fields) return
    updatePlayer(player.id, fields)
    setDraft(draftFrom({ ...player, ...fields }))
    toast.success('Player saved')
  }

  function discard() {
    setDraft(draftFrom(player))
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Field label="Name" htmlFor="player-name">
          <Input
            id="player-name"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            autoComplete="off"
            autoCapitalize="words"
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'player-name-error' : undefined}
          />
          {errors.name && (
            <p id="player-name-error" role="alert" className="text-sm font-medium text-brand-700">
              {errors.name}
            </p>
          )}
        </Field>

        <Field label="Number" htmlFor="player-number" hint="Jersey number 0–999; leave blank for no number.">
          <Input
            id="player-number"
            value={draft.number}
            onChange={(e) => set('number', e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="No number"
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={errors.number ? 'player-number-error' : undefined}
          />
          {errors.number && (
            <p id="player-number-error" role="alert" className="text-sm font-medium text-brand-700">
              {errors.number}
            </p>
          )}
        </Field>

        <Field label="Fitness Level" htmlFor="player-fitness">
          <Input
            id="player-fitness"
            value={draft.fitnessLevel}
            onChange={(e) => set('fitnessLevel', e.target.value)}
            placeholder="e.g. Good, 7/10, needs conditioning"
            autoComplete="off"
          />
        </Field>

        <Field label="Body Structure" htmlFor="player-body-structure">
          <Input
            id="player-body-structure"
            value={draft.bodyStructure}
            onChange={(e) => set('bodyStructure', e.target.value)}
            placeholder="e.g. 188 cm, 92 kg, long arms"
            autoComplete="off"
          />
        </Field>

        <Field label="Body Type" htmlFor="player-body-type">
          <Select
            id="player-body-type"
            value={draft.bodyType}
            onChange={(e) => set('bodyType', e.target.value as BodyType)}
            placeholder="Not set"
            options={BODY_TYPE_OPTIONS}
          />
        </Field>

        <Field
          label="Past Injuries"
          htmlFor="player-past-injuries"
          hint="History before this app; injuries reported in sessions appear in the Injury log below."
        >
          <Textarea
            id="player-past-injuries"
            value={draft.pastInjuries}
            onChange={(e) => set('pastInjuries', e.target.value)}
            rows={3}
            placeholder="e.g. ACL reconstruction 2023 (right knee)"
          />
        </Field>

        <Field label="Range of Motion (ROM)" htmlFor="player-rom">
          <Textarea
            id="player-rom"
            value={draft.rom}
            onChange={(e) => set('rom', e.target.value)}
            rows={3}
            placeholder="e.g. Limited left shoulder external rotation"
          />
        </Field>

        <Field label="Strengthening exercises" htmlFor="player-strengthening">
          <Textarea
            id="player-strengthening"
            value={draft.strengthening}
            onChange={(e) => set('strengthening', e.target.value)}
            rows={3}
            placeholder="e.g. Nordic curls 3×8, rotator cuff band work"
          />
        </Field>

        <p className="text-xs text-gray-500">
          {player.updatedAt === SEED_EPOCH ? 'Not edited yet' : `Last updated ${formatStamp(player.updatedAt)} by ${userName(player.updatedBy)}`}
        </p>
      </Card>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-gray-200 bg-white px-4 py-3">
        {dirty && (
          <p className="mb-2 text-sm font-medium text-amber-700" role="status">
            Unsaved changes
          </p>
        )}
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={discard} className="shrink-0">
              Discard
            </Button>
          )}
          <Button type="submit" full disabled={!canSave}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  )
}
