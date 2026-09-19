import { useMemo } from 'react'
import { WEEKDAY_LABELS, isInMonth, monthGrid, todayKey } from '../../lib/dates'
import { sessionIdFor } from '../../lib/ids'
import type { CalendarMode, DateKey, MonthKey, PersistedState, UserId } from '../../lib/types'
import { usersWorkedOn } from '../../store/selectors'
import { DayCell } from './DayCell'

export function MonthGrid({
  month,
  mode,
  teamEvents,
  workDays,
  sessions,
  currentUserId,
  onTap,
}: {
  month: MonthKey
  mode: CalendarMode
  teamEvents: PersistedState['teamEvents']
  workDays: PersistedState['workDays']
  sessions: PersistedState['sessions']
  currentUserId: UserId | null
  onTap: (date: DateKey) => void
}) {
  const keys = useMemo(() => monthGrid(month), [month])
  const today = todayKey()

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {keys.map((date) =>
          isInMonth(date, month) ? (
            <DayCell
              key={date}
              date={date}
              kind={teamEvents[date]?.kind ?? 'none'}
              workedBy={usersWorkedOn(workDays, date)}
              hasSession={sessions[sessionIdFor(date)] !== undefined}
              isToday={date === today}
              mode={mode}
              currentUserId={currentUserId}
              onTap={onTap}
            />
          ) : (
            <div key={date} aria-hidden="true" className="aspect-square min-h-11" />
          ),
        )}
      </div>
    </div>
  )
}
