import { Trophy, Volleyball } from 'lucide-react'
import { UserChip } from '../../components/ui/UserDot'
import { USER_LIST } from '../../lib/users'

export function CalendarLegend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
      <li className="inline-flex items-center gap-1.5">
        <Volleyball className="h-4 w-4 text-brand-600" aria-hidden="true" />
        Training
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Trophy className="h-4 w-4 text-brand-600" aria-hidden="true" />
        Game
      </li>
      <li className="inline-flex items-center gap-1.5">
        {/* Same marker DayCell shows top-right when a session exists for the day. */}
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />
        Session
      </li>
      {USER_LIST.map((user) => (
        <li key={user.id}>
          <UserChip userId={user.id} />
        </li>
      ))}
    </ul>
  )
}
