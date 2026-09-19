import { useMemo } from 'react'
import { Card, SectionTitle } from '../../components/ui/Card'
import { UserChip } from '../../components/ui/UserDot'
import { isInMonth } from '../../lib/dates'
import type { MonthKey, PersistedState } from '../../lib/types'
import { USER_LIST } from '../../lib/users'
import { useWorkDaysPerUser } from '../../store/selectors'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function MonthStats({ month, teamEvents }: { month: MonthKey; teamEvents: PersistedState['teamEvents'] }) {
  const perUser = useWorkDaysPerUser(month)
  const { trainings, games } = useMemo(() => {
    let trainings = 0
    let games = 0
    for (const event of Object.values(teamEvents)) {
      if (!isInMonth(event.date, month)) continue
      if (event.kind === 'training') trainings += 1
      else if (event.kind === 'game') games += 1
    }
    return { trainings, games }
  }, [teamEvents, month])

  return (
    <Card>
      <SectionTitle>Work days this month</SectionTitle>
      <ul className="mt-2 divide-y divide-gray-100">
        {USER_LIST.map((user) => (
          <li key={user.id} className="flex min-h-9 items-center justify-between gap-3 py-1">
            <UserChip userId={user.id} />
            <span className="text-base font-semibold text-gray-900 tabular-nums">{plural(perUser[user.id], 'day')}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-600">
        {plural(trainings, 'training')} · {plural(games, 'game')}
      </p>
    </Card>
  )
}
