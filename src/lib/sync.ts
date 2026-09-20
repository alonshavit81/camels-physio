/**
 * Pure rules behind the sync cues: "am I behind?", "where should the app open?".
 * Everything here is deterministic given the state and today's date, so the
 * UI stays thin and the rules are unit-tested.
 */
import { differenceInCalendarDays } from 'date-fns'
import { dateKey, fromDateKey, monthOf } from './dates'
import { sessionIdFor } from './ids'
import type { DateKey, PersistedState, Stamp, UserId } from './types'

/** What this phone last received from (or sent to) the group; persisted per device, never exported. */
export interface SyncInfo {
  at: Stamp
  by: UserId | null
  fileName: string
}

export interface SyncState {
  lastImport: SyncInfo | null
  lastExportAt: Stamp | null
  /** Data changed on this phone since its last successful export. */
  dirtySinceExport: boolean
  /** Day on which the "you may be behind" reminder was dismissed. */
  reminderDismissedOn: DateKey | null
}

export function initialSyncState(): SyncState {
  return { lastImport: null, lastExportAt: null, dirtySinceExport: false, reminderDismissedOn: null }
}

/**
 * Latest calendar date, not after `today`, on which the team had an event, a
 * physio worked, or a session exists. Null when the phone holds no activity.
 */
export function latestActivityDate(state: PersistedState, today: DateKey): DateKey | null {
  let latest: DateKey | null = null
  const consider = (d: DateKey) => {
    if (d <= today && (latest === null || d > latest)) latest = d
  }
  for (const s of Object.values(state.sessions)) consider(s.date)
  for (const e of Object.values(state.teamEvents)) if (e.kind !== 'none') consider(e.date)
  for (const w of Object.values(state.workDays)) if (w.worked) consider(w.date)
  return latest
}

/** The more recent of the last import and the last export, as a local calendar day. */
export function lastSyncDay(sync: Pick<SyncState, 'lastImport' | 'lastExportAt'>): DateKey | null {
  const stamps = [sync.lastImport?.at, sync.lastExportAt].filter((s): s is Stamp => typeof s === 'string' && s !== '')
  if (stamps.length === 0) return null
  const t = Date.parse(stamps.sort()[stamps.length - 1]!)
  return Number.isFinite(t) ? dateKey(new Date(t)) : null
}

/**
 * "You may be behind": the phone has activity newer than its last sync with the
 * group, i.e. the other physios may have recorded things this phone never
 * imported. A phone that was never synced nags as soon as it holds activity from
 * an earlier day (a brand-new phone on its first day is not behind anyone).
 * Dismissing the reminder silences it for the rest of that day.
 */
export function needsImportReminder(state: PersistedState & SyncState, today: DateKey): boolean {
  if (state.reminderDismissedOn === today) return false
  const latest = latestActivityDate(state, today)
  if (latest === null) return false
  const synced = lastSyncDay(state)
  if (synced === null) return hasActivityBefore(state, today)
  return latest > synced
}

/** True when the phone holds any session, live event or worked day dated before `today`. */
export function hasActivityBefore(state: PersistedState, today: DateKey): boolean {
  if (Object.values(state.sessions).some((s) => s.date < today)) return true
  if (Object.values(state.teamEvents).some((e) => e.kind !== 'none' && e.date < today)) return true
  return Object.values(state.workDays).some((w) => w.worked && w.date < today)
}

export interface HomeTarget {
  path: string
  /** Today's session does not exist yet but today is a training/game: run Apply first, then open it. */
  applyMonth: string | null
}

/**
 * Where the app should open: today's session when it exists, or when today is
 * a training/game (the session is created on the way), otherwise the calendar.
 */
export function homeTarget(state: PersistedState, today: DateKey): HomeTarget {
  const id = sessionIdFor(today)
  if (Object.hasOwn(state.sessions, id)) return { path: `/sessions/${id}`, applyMonth: null }
  const kind = state.teamEvents[today]?.kind ?? 'none'
  if (kind === 'training' || kind === 'game') return { path: `/sessions/${id}`, applyMonth: monthOf(today) }
  return { path: '/calendar', applyMonth: null }
}

/**
 * Sessions opened on the day (or the day after, for late entries) start with
 * everyone present, so the physio only taps the exceptions. Older sessions that
 * nobody touched stay unmarked: retro-marking a forgotten session as fully
 * attended would be a false record. Future sessions stay unmarked too: peeking
 * at next week's game must not record a roll call (and would keep an empty
 * session from being pruned when the calendar changes).
 */
export function shouldDefaultToPresent(sessionDate: DateKey, today: DateKey): boolean {
  const age = differenceInCalendarDays(fromDateKey(today), fromDateKey(sessionDate))
  return age >= 0 && age <= 1
}
