import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SectionTitle } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { todayKey } from '../../lib/dates'
import type { Injury } from '../../lib/types'
import { useInjuriesForPlayer } from '../../store/selectors'
import { InjuryFormModal } from '../injuries/InjuryFormModal'
import { InjuryItem } from '../injuries/InjuryItem'

interface Sheet {
  open: boolean
  /** Set when editing; undefined when reporting a new injury from the profile. */
  injury?: Injury
}

/** Derived list of the player's injuries (shared with session reports) with add/edit. */
export function PlayerInjuryLog({ playerId }: { playerId: string }) {
  const injuries = useInjuriesForPlayer(playerId)
  const [sheet, setSheet] = useState<Sheet>({ open: false })
  const active = injuries.filter((i) => i.status === 'Active').length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SectionTitle>Injury log</SectionTitle>
            {active > 0 && <Badge tone="red">{active} active</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">Synced from session reports</p>
        </div>
        <Button size="sm" variant="secondary" className="min-h-11 shrink-0" onClick={() => setSheet({ open: true })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add injury
        </Button>
      </div>

      {injuries.length === 0 ? (
        <EmptyState title="No injuries logged yet" description="Injuries reported in sessions will show up here automatically." />
      ) : (
        <ul aria-label="Injuries" className="flex flex-col gap-2">
          {injuries.map((injury) => (
            <li key={injury.id}>
              <InjuryItem injury={injury} showSessionLink onEdit={() => setSheet({ open: true, injury })} />
            </li>
          ))}
        </ul>
      )}

      <InjuryFormModal
        open={sheet.open}
        onClose={() => setSheet({ open: false })}
        playerId={playerId}
        sessionId={null}
        defaultDate={todayKey()}
        injury={sheet.injury}
      />
    </section>
  )
}
