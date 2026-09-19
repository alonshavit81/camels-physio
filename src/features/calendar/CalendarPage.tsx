import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { currentMonthKey, shiftMonth } from '../../lib/dates'
import type { CalendarMode, DateKey, MonthKey } from '../../lib/types'
import { TEAM_EVENT_PERMISSION_MESSAGE, canEditTeamEvents } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'
import { toast } from '../../store/toastStore'
import { CalendarLegend } from './CalendarLegend'
import { ModeToggle } from './ModeToggle'
import { MonthGrid } from './MonthGrid'
import { MonthHeader } from './MonthHeader'
import { MonthStats } from './MonthStats'
import { initialCalendarMode, rememberCalendarMode } from './modeStorage'

export function CalendarPage() {
  const navigate = useNavigate()
  const teamEvents = useAppStore((s) => s.teamEvents)
  const workDays = useAppStore((s) => s.workDays)
  const sessions = useAppStore((s) => s.sessions)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const cycleTeamEvent = useAppStore((s) => s.cycleTeamEvent)
  const toggleWorkDay = useAppStore((s) => s.toggleWorkDay)
  const applyMonthlyAttendance = useAppStore((s) => s.applyMonthlyAttendance)

  const [month, setMonth] = useState<MonthKey>(() => currentMonthKey())
  const [mode, setModeState] = useState<CalendarMode>(() => initialCalendarMode(currentUserId))
  const thisMonth = currentMonthKey()

  const setMode = (next: CalendarMode) => {
    setModeState(next)
    rememberCalendarMode(next)
  }

  const handleTap = (date: DateKey) => {
    if (mode === 'team') {
      const ok = cycleTeamEvent(date)
      if (!ok) toast.error(TEAM_EVENT_PERMISSION_MESSAGE)
    } else {
      toggleWorkDay(date)
    }
  }

  const handleApply = () => {
    const r = applyMonthlyAttendance(month)
    if (r.created + r.updated + r.unchanged + r.pruned === 0) {
      toast.info('Nothing to apply: no team events or work days this month')
      return
    }
    toast.success(
      `Created ${r.created} session${r.created === 1 ? '' : 's'} (${r.updated + r.unchanged} already existed)` +
        (r.pruned ? `, removed ${r.pruned} empty` : ''),
    )
    navigate('/sessions')
  }

  return (
    <div className="flex flex-col gap-4">
      <MonthHeader
        month={month}
        isCurrentMonth={month === thisMonth}
        onPrev={() => setMonth((m) => shiftMonth(m, -1))}
        onNext={() => setMonth((m) => shiftMonth(m, 1))}
        onToday={() => setMonth(thisMonth)}
      />
      <ModeToggle mode={mode} onChange={setMode} canEditTeamEvents={canEditTeamEvents(currentUserId)} />
      <MonthGrid
        month={month}
        mode={mode}
        teamEvents={teamEvents}
        workDays={workDays}
        sessions={sessions}
        currentUserId={currentUserId}
        onTap={handleTap}
      />
      <CalendarLegend />
      <MonthStats month={month} teamEvents={teamEvents} />
      <section aria-label="Apply monthly attendance" className="flex flex-col gap-2">
        <p className="text-center text-sm text-gray-500">Creates one editable session for every training, game or work day this month.</p>
        <Button full onClick={handleApply}>
          Apply Monthly Attendance
        </Button>
      </section>
    </div>
  )
}
