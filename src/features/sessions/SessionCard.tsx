import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { UserDot } from '../../components/ui/UserDot'
import { isSessionOnCalendar } from '../../lib/apply'
import { formatDayLong } from '../../lib/dates'
import type { Session } from '../../lib/types'
import { USERS } from '../../lib/users'
import { useAppStore } from '../../store/useAppStore'
import { sessionInjuryCount, sessionPresentCount, usersWorkedOn } from '../../store/selectors'
import { SessionTypeBadge } from './SessionTypeBadge'

/** One row of the sessions list; tapping opens the session detail. `rosterSize` is the live roster count for "N/M present". */
export function SessionCard({ session, rosterSize }: { session: Session; rosterSize: number }) {
  // Narrow subscriptions: each returns a primitive or a shallow-compared list.
  const workedPhysios = useAppStore(useShallow((s) => usersWorkedOn(s.workDays, session.date)))
  const injuryCount = useAppStore((s) => sessionInjuryCount(s.injuries, session.id))
  const onCalendar = useAppStore((s) => isSessionOnCalendar(s, session))

  const physios = workedPhysios.length > 0 ? workedPhysios : session.physios
  const present = sessionPresentCount(session)

  return (
    <Link to={`/sessions/${session.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
      <Card className="flex min-h-14 items-center gap-3 p-3 transition hover:bg-gray-50 active:bg-gray-100">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-gray-900">{formatDayLong(session.date)}</span>
            <SessionTypeBadge type={session.type} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            {physios.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {physios.map((id) => (
                  <UserDot key={id} userId={id} size="sm" />
                ))}
                <span className="sr-only">Physios: {physios.map((id) => USERS[id].name).join(', ')}</span>
              </span>
            )}
            <span>
              {present}/{rosterSize} present
            </span>
            {injuryCount > 0 && (
              <span className="font-medium text-brand-700">
                {injuryCount} {injuryCount === 1 ? 'injury' : 'injuries'}
              </span>
            )}
            {!onCalendar && <Badge tone="amber">Not on calendar</Badge>}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </Card>
    </Link>
  )
}
