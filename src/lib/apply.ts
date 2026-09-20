/**
 * "Apply Monthly Attendance" — pure logic.
 *
 * From the calendar (team events + per-physio work days) generate or refresh
 * exactly one editable session per date of a month, idempotently:
 *
 * - a date is "backed" by the calendar when it has a training/game event or at
 *   least one physio marked the day as worked;
 * - backed + no session      → create an empty session;
 * - backed + session         → refresh only `type` and `physios` when they changed
 *                              (notes, attendance and createdAt are never touched);
 * - not backed + session     → remove it only if it is completely empty, otherwise
 *                              keep it (the UI shows a "Not on calendar" badge).
 *
 * Sessions outside the month are never touched. Inputs are never mutated: the
 * function returns a new state object with a new `sessions` map, but sessions
 * that did not change keep their object identity (structural sharing).
 *
 * Two details matter for the phone-to-phone merge (see merge.ts):
 * - the blank notes of a generated session carry `BLANK_NOTES_STAMP`, a stamp
 *   far in the past, so they never win against notes typed on another phone;
 * - a record that slipped past validation (missing notes, a null attendance
 *   entry, junk under a session key, ...) is tolerated instead of aborting the
 *   whole month: missing pieces count as "no data", junk entries as "no session".
 */

import { USER_IDS } from './types'
import type {
  ApplyResult,
  DateKey,
  MonthKey,
  PersistedState,
  Session,
  SessionType,
  Stamp,
  TeamEventKind,
  UserId,
} from './types'
import { monthDays } from './dates'
import { sessionIdFor, workDayIdFor } from './ids'
import { SEED_EPOCH } from './seedPlayers'

/**
 * Stamp of the blank notes of a generated session. Generated notes are not a
 * user edit, so they must never beat real notes in a merge: every phone runs
 * Apply on its own and would otherwise produce an empty-notes record with a
 * fresh (winning) stamp. Like SEED_EPOCH, it is far in the past so that ANY
 * real edit, even one typed before the Apply, wins. Editing the notes stamps
 * them with the real time (store), which is what makes them win from then on.
 */
export const BLANK_NOTES_STAMP: Stamp = SEED_EPOCH

/**
 * Stamp of the attendance marks a session gets when it is opened on the day
 * and nobody has marked anyone yet ("everyone present, tap the exceptions").
 * Like the blank notes, those marks are generated data, not a physio's record,
 * so they must never beat a real mark from another phone, even an earlier one:
 * the far-past stamp loses against any real stamp in a merge, and a tap on top
 * of a default mark takes the real time (nextStamp), which wins from then on.
 */
export const DEFAULT_ATTENDANCE_STAMP: Stamp = BLANK_NOTES_STAMP

/** Non-null object check for records that may have slipped past validation. */
function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

/**
 * Users who marked `date` as a worked day (`worked === true`), in USER_IDS order.
 * A `worked: false` record is a tombstone and counts as "not worked".
 */
export function physiosForDate(workDays: PersistedState['workDays'], date: DateKey): UserId[] {
  const physios: UserId[] = []
  for (const userId of USER_IDS) {
    if (workDays[workDayIdFor(userId, date)]?.worked === true) physios.push(userId)
  }
  return physios
}

/**
 * Session type a date should have, with precedence game > training > workday.
 * Returns null when the date is not backed by the calendar at all (no event, or
 * the event was cleared to 'none', and nobody worked that day).
 */
export function deriveSessionType(kind: TeamEventKind | undefined, physios: UserId[]): SessionType | null {
  if (kind === 'game') return 'game'
  if (kind === 'training') return 'training'
  if (physios.length > 0) return 'workday'
  return null
}

/**
 * True when the session holds no user data at all: every attendance entry is
 * 'unset' (or there are none), the notes are blank, and no live (non-deleted)
 * injury was reported in it. Only such sessions may be pruned.
 */
export function sessionIsEmpty(session: Session, injuries: PersistedState['injuries']): boolean {
  // The reads are deliberately tolerant (`?? {}`, `?.`, isRecord): a malformed
  // record must not abort a whole monthly apply. A missing piece counts as
  // "no data"; anything present but unrecognised counts as data (never pruned).
  for (const entry of Object.values(session.playerAttendance ?? {})) {
    if (isRecord(entry) && entry.status !== 'unset') return false
  }
  if (String(session.notes?.text ?? '').trim() !== '') return false
  for (const injury of Object.values(injuries)) {
    if (isRecord(injury) && !injury.deleted && injury.sessionId === session.id) return false
  }
  return true
}

/** True when the session's date is still backed by the calendar (event or worked day). */
export function isSessionOnCalendar(state: PersistedState, session: Session): boolean {
  const kind = state.teamEvents[session.date]?.kind
  const physios = physiosForDate(state.workDays, session.date)
  return deriveSessionType(kind, physios) !== null
}

/** Ordered comparison: `physios` is always produced in USER_IDS order, so order is meaningful. */
function samePhysios(a: readonly UserId[], b: readonly UserId[]): boolean {
  return a.length === b.length && a.every((userId, i) => userId === b[i])
}

/**
 * Generate / refresh / prune the sessions of `month` from the calendar.
 * Pure: returns a new state (new `sessions` map) and a summary of what happened.
 * Running it twice in a row is a complete no-op the second time.
 */
export function applyMonthlyAttendance(
  state: PersistedState,
  month: MonthKey,
  now: Stamp,
  user: UserId,
): { state: PersistedState; result: ApplyResult } {
  // Shallow copy: untouched sessions keep their identity, only this month's entries change.
  const sessions: Record<string, Session> = { ...state.sessions }
  const result: ApplyResult = { created: 0, updated: 0, unchanged: 0, pruned: 0 }

  for (const date of monthDays(month)) {
    const kind = state.teamEvents[date]?.kind
    const physios = physiosForDate(state.workDays, date)
    const type = deriveSessionType(kind, physios)
    const id = sessionIdFor(date)
    const existing = state.sessions[id]

    if (type !== null) {
      // A non-object under the key (junk) counts as "no session" and is replaced.
      if (!isRecord(existing)) {
        sessions[id] = {
          id,
          date,
          type,
          physios,
          notes: { text: '', updatedAt: BLANK_NOTES_STAMP, updatedBy: user },
          playerAttendance: {},
          createdAt: now,
          createdBy: user,
        }
        result.created++
      } else if (existing.type !== type || !Array.isArray(existing.physios) || !samePhysios(existing.physios, physios)) {
        // Refresh only what the calendar owns; user-entered data stays as is.
        // (A missing/invalid `physios` counts as different, so it gets repaired.)
        sessions[id] = { ...existing, type, physios }
        result.updated++
      } else {
        result.unchanged++
      }
    } else if (existing !== undefined) {
      // Junk under the key is never worth keeping; a real session only when empty.
      if (!isRecord(existing) || sessionIsEmpty(existing, state.injuries)) {
        delete sessions[id]
        result.pruned++
      } else {
        // Orphaned but holds data: keep it, the UI flags it "Not on calendar".
        result.unchanged++
      }
    }
  }

  return { state: { ...state, sessions }, result }
}
