import { SegmentedControl, type SegmentOption } from '../../components/ui/SegmentedControl'
import type { CalendarMode } from '../../lib/types'

const OPTIONS: ReadonlyArray<SegmentOption<CalendarMode>> = [
  { value: 'team', label: 'Team Events' },
  { value: 'me', label: 'My Attendance' },
]

export function ModeToggle({
  mode,
  onChange,
  canEditTeamEvents,
}: {
  mode: CalendarMode
  onChange: (mode: CalendarMode) => void
  canEditTeamEvents: boolean
}) {
  const hint =
    mode === 'me'
      ? 'Tap the days you worked'
      : canEditTeamEvents
        ? 'Tap a day: Training → Game → Clear'
        : 'View only — only Shahar can set team events'
  return (
    <div>
      <SegmentedControl options={OPTIONS} value={mode} onChange={onChange} ariaLabel="Calendar mode" />
      <p className="mt-2 text-center text-sm text-gray-500" aria-live="polite">
        {hint}
      </p>
    </div>
  )
}
