import { CALENDAR_MODES, type CalendarMode, type UserId } from '../../lib/types'
import { canEditTeamEvents } from '../../lib/users'

/** Per-device preference only (never exported): the last calendar mode used. */
export const CALENDAR_MODE_STORAGE_KEY = 'camels-physio:calendar-mode'

function isCalendarMode(value: unknown): value is CalendarMode {
  return typeof value === 'string' && (CALENDAR_MODES as readonly string[]).includes(value)
}

/** Last mode used on this device, else the role default: manager → team events, physios → own attendance. */
export function initialCalendarMode(userId: UserId | null): CalendarMode {
  try {
    const stored = localStorage.getItem(CALENDAR_MODE_STORAGE_KEY)
    if (isCalendarMode(stored)) return stored
  } catch {
    // Storage blocked (private mode, quota): fall through to the default.
  }
  return canEditTeamEvents(userId) ? 'team' : 'me'
}

export function rememberCalendarMode(mode: CalendarMode): void {
  try {
    localStorage.setItem(CALENDAR_MODE_STORAGE_KEY, mode)
  } catch {
    // Best effort only.
  }
}
