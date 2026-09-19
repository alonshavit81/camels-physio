import { USERS } from '../../lib/users'
import type { UserId } from '../../lib/types'
import { cn } from '../../lib/cn'

const SIZES = { xs: 'h-2 w-2', sm: 'h-2.5 w-2.5', md: 'h-3.5 w-3.5', lg: 'h-5 w-5' } as const

/** Coloured dot identifying a user. Decorative: pair it with the user's name or a title. */
export function UserDot({ userId, size = 'md', className }: { userId: UserId; size?: keyof typeof SIZES; className?: string }) {
  const user = USERS[userId]
  return <span aria-hidden="true" title={user.name} className={cn('inline-block shrink-0 rounded-full', user.dotClass, SIZES[size], className)} />
}

/** Dot + name, for legends, stats and chips. */
export function UserChip({ userId, className }: { userId: UserId; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <UserDot userId={userId} size="sm" />
      {USERS[userId].name}
    </span>
  )
}
