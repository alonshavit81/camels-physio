import { USER_IDS, type UserId } from './types'

export type UserRole = 'Manager' | 'Physio'

export interface UserInfo {
  id: UserId
  name: string
  role: UserRole
  /** Hex colour for the calendar attendance dot (contrasts with the red theme). */
  color: string
  /** Tailwind class for the dot background; must be a literal so Tailwind can see it. */
  dotClass: string
}

export const USERS: Record<UserId, UserInfo> = {
  shahar: { id: 'shahar', name: 'Shahar', role: 'Manager', color: '#2563eb', dotClass: 'bg-user-shahar' },
  maya: { id: 'maya', name: 'Maya', role: 'Physio', color: '#16a34a', dotClass: 'bg-user-maya' },
  neta: { id: 'neta', name: 'Neta', role: 'Physio', color: '#7c3aed', dotClass: 'bg-user-neta' },
}

export const USER_LIST: UserInfo[] = USER_IDS.map((id) => USERS[id])

export const MANAGER_ID: UserId = 'shahar'

export const TEAM_EVENT_PERMISSION_MESSAGE = 'Only Shahar can set team events'

export function isUserId(value: unknown): value is UserId {
  return typeof value === 'string' && (USER_IDS as readonly string[]).includes(value)
}

export function canEditTeamEvents(userId: UserId | null): boolean {
  return userId === MANAGER_ID
}

/** Total: an unknown id (stale record, edited file) renders as "Unknown" instead of throwing mid-render. */
export function userName(userId: UserId | null): string {
  return userId !== null ? (USERS[userId]?.name ?? 'Unknown') : 'Unknown'
}
