import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SegmentedControl, type SegmentOption } from '../../components/ui/SegmentedControl'
import type { AttendanceStatus, Injury, Player } from '../../lib/types'
import { InjuryItem } from '../injuries/InjuryItem'

const STATUS_OPTIONS: ReadonlyArray<SegmentOption<AttendanceStatus>> = [
  {
    value: 'unset',
    // Visible dash, spoken "Not marked" (the button's accessible name comes from its content).
    label: (
      <>
        <span aria-hidden="true">–</span>
        <span className="sr-only">Not marked</span>
      </>
    ),
    title: 'Not marked',
  },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'injured', label: 'Injured' },
]

export interface RosterRowProps {
  player: Player
  status: AttendanceStatus
  /** This player's injuries reported in this session. */
  injuries: Injury[]
  onStatusChange: (status: AttendanceStatus) => void
  onReportInjury: () => void
  onEditInjury: (injury: Injury) => void
}

/** One player in the session roster: attendance control, injury shortcut and this session's injuries. */
export function RosterRow({ player, status, injuries, onStatusChange, onReportInjury, onEditInjury }: RosterRowProps) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="flex min-h-11 items-center gap-3">
        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 px-1.5 text-sm font-bold tabular-nums text-gray-700">
          {player.number ?? '–'}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">{player.name}</span>
        <Button size="sm" variant="ghost" onClick={onReportInjury} aria-label={`Report injury for ${player.name}`} className="min-h-11 shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" /> Injury
        </Button>
      </div>
      {/* sm keeps the labels narrow enough for four segments at 375px; the segments themselves get a 44px hit area. */}
      <SegmentedControl
        size="sm"
        className="mt-2 [&>button]:min-h-11"
        ariaLabel={`Attendance for ${player.name}`}
        options={STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
      />
      {injuries.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {injuries.map((injury) => (
            <li key={injury.id}>
              <InjuryItem injury={injury} onEdit={() => onEditInjury(injury)} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
