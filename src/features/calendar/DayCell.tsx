import { Trophy, Volleyball } from 'lucide-react'
import { UserDot } from '../../components/ui/UserDot'
import { cn } from '../../lib/cn'
import { formatDayLong } from '../../lib/dates'
import type { CalendarMode, DateKey, TeamEventKind, UserId } from '../../lib/types'
import { USERS } from '../../lib/users'

/**
 * Literal class names so Tailwind can see them (colours come from the
 * --color-user-* theme tokens in index.css). Tailwind's `inset-ring` composes
 * with the today `ring` through the box-shadow variable stack, which an inline
 * `style.boxShadow` would overwrite.
 */
const WORKED_CLASS: Record<UserId, string> = {
  shahar: 'border-user-shahar inset-ring-user-shahar',
  maya: 'border-user-maya inset-ring-user-maya',
  neta: 'border-user-neta inset-ring-user-neta',
}

const KIND_LABEL: Record<TeamEventKind, string> = { none: '', training: 'Training', game: 'Game' }

function joinNames(ids: readonly UserId[]): string {
  const names = ids.map((id) => USERS[id].name)
  if (names.length <= 1) return names.join('')
  const last = names[names.length - 1] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${last}`
}

export interface DayCellProps {
  date: DateKey
  kind: TeamEventKind
  /** Users who marked the day as worked, in USER_IDS order. */
  workedBy: UserId[]
  hasSession: boolean
  isToday: boolean
  mode: CalendarMode
  currentUserId: UserId | null
  onTap: (date: DateKey) => void
}

export function DayCell({ date, kind, workedBy, hasSession, isToday, mode, currentUserId, onTap }: DayCellProps) {
  const dayNumber = Number(date.slice(8, 10))
  const mine = currentUserId !== null && workedBy.includes(currentUserId)
  // In "me" mode the user's own days get a tinted background + outline in their colour.
  const workedClass = mode === 'me' && currentUserId !== null && mine ? WORKED_CLASS[currentUserId] : null
  const Icon = kind === 'training' ? Volleyball : kind === 'game' ? Trophy : null

  const parts = [formatDayLong(date)]
  if (kind !== 'none') parts.push(KIND_LABEL[kind])
  if (workedBy.length > 0) parts.push(`${joinNames(workedBy)} worked`)
  if (hasSession) parts.push('session exists')

  return (
    <button
      type="button"
      onClick={() => onTap(date)}
      aria-label={parts.join(', ')}
      aria-pressed={mode === 'me' ? mine : undefined}
      className={cn(
        'relative flex aspect-square min-h-11 w-full items-center justify-center rounded-xl border transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        workedClass ? cn('bg-brand-50 inset-ring', workedClass) : 'border-gray-200 bg-white',
        isToday && 'ring-2 ring-brand-600',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute top-0.5 left-1 text-xs leading-none font-semibold', isToday ? 'text-brand-700' : 'text-gray-600')}
      >
        {dayNumber}
      </span>
      {hasSession && <span aria-hidden="true" className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-gray-400" />}
      {Icon && <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />}
      {workedBy.length > 0 && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
          {workedBy.map((id) => (
            <UserDot key={id} userId={id} size="xs" />
          ))}
        </span>
      )}
    </button>
  )
}
