import { describe, it, expect } from 'vitest'
import {
  BLANK_NOTES_STAMP,
  applyMonthlyAttendance,
  deriveSessionType,
  isSessionOnCalendar,
  physiosForDate,
  sessionIsEmpty,
} from './apply'
import { emptyPersistedState } from './types'
import type {
  AttendanceStatus,
  DateKey,
  Injury,
  PersistedState,
  PlayerAttendance,
  Session,
  TeamEvent,
  TeamEventKind,
  UserId,
  WorkDay,
} from './types'
import { monthDays } from './dates'
import { sessionIdFor, workDayIdFor } from './ids'
import { mergeState } from './merge'

// ------------------------------------------------------------------ fixtures

const MONTH = '2026-09'
const NOW = '2026-09-19T10:00:00.000Z'
const LATER = '2026-09-20T10:00:00.000Z'
const D1: DateKey = '2026-09-03'
const D2: DateKey = '2026-09-10'
const D3: DateKey = '2026-09-17'
const OTHER_MONTH_DATE: DateKey = '2026-08-20'

function teamEvent(date: DateKey, kind: TeamEventKind): TeamEvent {
  return { id: date, date, kind, updatedAt: NOW, updatedBy: 'shahar' }
}

function workDay(userId: UserId, date: DateKey, worked = true): WorkDay {
  return { id: workDayIdFor(userId, date), userId, date, worked, updatedAt: NOW, updatedBy: userId }
}

function attendance(status: AttendanceStatus): PlayerAttendance {
  return { status, updatedAt: NOW, updatedBy: 'maya' }
}

function injury(overrides: Partial<Injury> & Pick<Injury, 'id' | 'sessionId'>): Injury {
  return {
    playerId: 'p-cohen-uri',
    date: D1,
    bodyPart: 'Knee',
    side: 'left',
    severity: 'Medium',
    status: 'Active',
    description: '',
    reportedBy: 'maya',
    deleted: false,
    updatedAt: NOW,
    updatedBy: 'maya',
    ...overrides,
  }
}

function session(date: DateKey, overrides: Partial<Session> = {}): Session {
  return {
    id: sessionIdFor(date),
    date,
    type: 'training',
    physios: [],
    notes: { text: '', updatedAt: NOW, updatedBy: 'maya' },
    playerAttendance: {},
    createdAt: NOW,
    createdBy: 'maya',
    ...overrides,
  }
}

/** The session of `date`, failing loudly when it is missing. */
function getSession(state: PersistedState, date: DateKey): Session {
  const s = state.sessions[sessionIdFor(date)]
  if (!s) throw new Error(`no session for ${date}`)
  return s
}

/** Build a state from lists, keyed by each record's id. */
function stateWith(parts: {
  teamEvents?: TeamEvent[]
  workDays?: WorkDay[]
  sessions?: Session[]
  injuries?: Injury[]
}): PersistedState {
  const s = emptyPersistedState()
  for (const e of parts.teamEvents ?? []) s.teamEvents[e.id] = e
  for (const w of parts.workDays ?? []) s.workDays[w.id] = w
  for (const x of parts.sessions ?? []) s.sessions[x.id] = x
  for (const i of parts.injuries ?? []) s.injuries[i.id] = i
  return s
}

/** Recursively freeze so that any mutation of the input throws (strict mode / ESM). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

// --------------------------------------------------------------- unit tests

describe('physiosForDate', () => {
  it('returns users with worked === true, in USER_IDS order', () => {
    const s = stateWith({ workDays: [workDay('neta', D1), workDay('shahar', D1)] })
    expect(physiosForDate(s.workDays, D1)).toEqual(['shahar', 'neta'])
  })

  it('ignores tombstones (worked === false) and other dates', () => {
    const s = stateWith({ workDays: [workDay('maya', D1, false), workDay('neta', D2)] })
    expect(physiosForDate(s.workDays, D1)).toEqual([])
  })
})

describe('deriveSessionType', () => {
  it('follows precedence game > training > workday', () => {
    expect(deriveSessionType('game', ['maya'])).toBe('game')
    expect(deriveSessionType('game', [])).toBe('game')
    expect(deriveSessionType('training', ['maya'])).toBe('training')
    expect(deriveSessionType('training', [])).toBe('training')
    expect(deriveSessionType('none', ['maya'])).toBe('workday')
    expect(deriveSessionType(undefined, ['maya'])).toBe('workday')
  })

  it('returns null when the date is not backed by the calendar', () => {
    expect(deriveSessionType(undefined, [])).toBeNull()
    expect(deriveSessionType('none', [])).toBeNull()
  })
})

describe('sessionIsEmpty', () => {
  it('is true for a fresh session and for unset-only attendance / whitespace notes', () => {
    expect(sessionIsEmpty(session(D1), {})).toBe(true)
    const s = session(D1, {
      playerAttendance: { 'p-a': attendance('unset') },
      notes: { text: '   \n', updatedAt: NOW, updatedBy: 'maya' },
    })
    expect(sessionIsEmpty(s, {})).toBe(true)
  })

  it('is false when attendance is set, notes exist, or a live injury references it', () => {
    expect(sessionIsEmpty(session(D1, { playerAttendance: { 'p-a': attendance('present') } }), {})).toBe(false)
    expect(sessionIsEmpty(session(D1, { notes: { text: 'x', updatedAt: NOW, updatedBy: 'maya' } }), {})).toBe(false)
    const live = injury({ id: 'i-1', sessionId: sessionIdFor(D1) })
    expect(sessionIsEmpty(session(D1), { [live.id]: live })).toBe(false)
  })

  it('ignores deleted injuries and injuries of other sessions', () => {
    const deleted = injury({ id: 'i-1', sessionId: sessionIdFor(D1), deleted: true })
    const elsewhere = injury({ id: 'i-2', sessionId: sessionIdFor(D2) })
    const fromProfile = injury({ id: 'i-3', sessionId: null })
    expect(sessionIsEmpty(session(D1), { 'i-1': deleted, 'i-2': elsewhere, 'i-3': fromProfile })).toBe(true)
  })
})

describe('isSessionOnCalendar', () => {
  it('reflects whether the date has an event or a worked day', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'training'), teamEvent(D3, 'none')], workDays: [workDay('maya', D2)] })
    expect(isSessionOnCalendar(s, session(D1))).toBe(true)
    expect(isSessionOnCalendar(s, session(D2))).toBe(true)
    expect(isSessionOnCalendar(s, session(D3))).toBe(false)
    expect(isSessionOnCalendar(s, session('2026-09-25'))).toBe(false)
  })
})

// ------------------------------------------------------ applyMonthlyAttendance

describe('applyMonthlyAttendance', () => {
  it('creates a session for an event-only date', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'training')] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 1, updated: 0, unchanged: 0, pruned: 0 })
    expect(state.sessions[sessionIdFor(D1)]).toEqual({
      id: sessionIdFor(D1),
      date: D1,
      type: 'training',
      physios: [],
      notes: { text: '', updatedAt: BLANK_NOTES_STAMP, updatedBy: 'maya' },
      playerAttendance: {},
      createdAt: NOW,
      createdBy: 'maya',
    })
    expect(Object.keys(state.sessions)).toEqual([sessionIdFor(D1)])
  })

  it('creates a workday session for a worked-day-only date', () => {
    const s = stateWith({ workDays: [workDay('neta', D2)] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'neta')
    expect(result).toEqual({ created: 1, updated: 0, unchanged: 0, pruned: 0 })
    expect(state.sessions[sessionIdFor(D2)]).toMatchObject({ type: 'workday', physios: ['neta'], createdBy: 'neta' })
  })

  it('creates an event session with physios when a date has both', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'game')], workDays: [workDay('maya', D1), workDay('shahar', D1)] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'shahar')
    expect(result.created).toBe(1)
    expect(state.sessions[sessionIdFor(D1)]).toMatchObject({ type: 'game', physios: ['shahar', 'maya'] })
  })

  it('applies precedence game > training > workday per date', () => {
    const s = stateWith({
      teamEvents: [teamEvent(D1, 'game'), teamEvent(D2, 'training'), teamEvent(D3, 'none')],
      workDays: [workDay('maya', D1), workDay('maya', D2), workDay('maya', D3)],
    })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result.created).toBe(3)
    expect(state.sessions[sessionIdFor(D1)]?.type).toBe('game')
    expect(state.sessions[sessionIdFor(D2)]?.type).toBe('training')
    expect(state.sessions[sessionIdFor(D3)]?.type).toBe('workday')
  })

  it('does not create anything for a cleared event (none) without physios', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'none')], workDays: [workDay('maya', D2, false)] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 0 })
    expect(state.sessions).toEqual({})
  })

  it('is idempotent: the second run is a complete no-op with identical sessions', () => {
    const s = stateWith({
      teamEvents: [teamEvent(D1, 'game'), teamEvent(D2, 'training')],
      workDays: [workDay('maya', D1), workDay('neta', D3)],
    })
    const first = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(first.result).toEqual({ created: 3, updated: 0, unchanged: 0, pruned: 0 })

    const second = applyMonthlyAttendance(first.state, MONTH, LATER, 'neta')
    expect(second.result).toEqual({ created: 0, updated: 0, unchanged: 3, pruned: 0 })
    expect(second.state.sessions).toEqual(first.state.sessions)
    // Structural sharing: unchanged sessions keep their object identity.
    for (const id of Object.keys(first.state.sessions)) {
      expect(second.state.sessions[id]).toBe(first.state.sessions[id])
    }
  })

  it('flips training → game on the next apply while preserving notes, attendance and createdAt', () => {
    const notes = { text: 'Tough one', updatedAt: NOW, updatedBy: 'maya' as const }
    const playerAttendance = { 'p-a': attendance('present'), 'p-b': attendance('injured') }
    const existing = session(D1, { type: 'training', physios: ['maya'], notes, playerAttendance, createdAt: '2026-09-01T00:00:00.000Z', createdBy: 'shahar' })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'game')], workDays: [workDay('maya', D1)], sessions: [existing] })

    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'neta')
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0, pruned: 0 })
    const refreshed = state.sessions[sessionIdFor(D1)]
    expect(refreshed).not.toBe(existing)
    expect(refreshed).toEqual({ ...existing, type: 'game' })
    expect(refreshed?.notes).toBe(notes)
    expect(refreshed?.playerAttendance).toBe(playerAttendance)
    expect(refreshed?.createdAt).toBe('2026-09-01T00:00:00.000Z')
    expect(refreshed?.createdBy).toBe('shahar')
  })

  it('refreshes physios when a second physio marks the day', () => {
    const existing = session(D2, { type: 'workday', physios: ['maya'] })
    const s = stateWith({ workDays: [workDay('maya', D2), workDay('shahar', D2)], sessions: [existing] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'shahar')
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0, pruned: 0 })
    expect(state.sessions[sessionIdFor(D2)]).toMatchObject({ type: 'workday', physios: ['shahar', 'maya'] })
  })

  it('normalises physios order (ordered comparison) after a merge produced a different order', () => {
    const existing = session(D2, { type: 'workday', physios: ['neta', 'shahar'] })
    const s = stateWith({ workDays: [workDay('shahar', D2), workDay('neta', D2)], sessions: [existing] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'shahar')
    expect(result.updated).toBe(1)
    expect(state.sessions[sessionIdFor(D2)]?.physios).toEqual(['shahar', 'neta'])
  })

  it('prunes the empty session when the only physio un-marks a workday-only date', () => {
    const marked = stateWith({ workDays: [workDay('maya', D2)] })
    const first = applyMonthlyAttendance(marked, MONTH, NOW, 'maya')
    expect(first.result.created).toBe(1)

    const unmarked: PersistedState = { ...first.state, workDays: { [workDayIdFor('maya', D2)]: workDay('maya', D2, false) } }
    const second = applyMonthlyAttendance(unmarked, MONTH, LATER, 'maya')
    expect(second.result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 1 })
    expect(second.state.sessions).toEqual({})
  })

  it('prunes an orphaned session whose only attendance entries are unset', () => {
    const existing = session(D1, { playerAttendance: { 'p-a': attendance('unset') } })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'none')], sessions: [existing] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result.pruned).toBe(1)
    expect(state.sessions[sessionIdFor(D1)]).toBeUndefined()
  })

  it('keeps a non-empty session (attendance present) when its event is removed', () => {
    const existing = session(D1, { playerAttendance: { 'p-a': attendance('present') } })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'none')], sessions: [existing] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 1, pruned: 0 })
    expect(state.sessions[sessionIdFor(D1)]).toBe(existing)
  })

  it('keeps a non-empty session (notes) when its event is removed', () => {
    const existing = session(D1, { notes: { text: 'keep me', updatedAt: NOW, updatedBy: 'maya' } })
    const s = stateWith({ sessions: [existing] }) // no event at all, nobody worked
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 1, pruned: 0 })
    expect(state.sessions[sessionIdFor(D1)]).toBe(existing)
  })

  it('keeps a session referenced by a live injury when its event is removed', () => {
    const existing = session(D1)
    const live = injury({ id: 'i-live', sessionId: existing.id })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'none')], sessions: [existing], injuries: [live] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 1, pruned: 0 })
    expect(state.sessions[sessionIdFor(D1)]).toBe(existing)
  })

  it('does not let a deleted injury keep an orphaned session alive', () => {
    const existing = session(D1)
    const gone = injury({ id: 'i-gone', sessionId: existing.id, deleted: true })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'none')], sessions: [existing], injuries: [gone] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 1 })
    expect(state.sessions).toEqual({})
  })

  it('only touches the requested month: other months keep their sessions (same identity) and gain none', () => {
    // An orphaned empty session in August would be pruned if August were applied.
    const august = session(OTHER_MONTH_DATE)
    const s = stateWith({
      teamEvents: [teamEvent(D1, 'training'), teamEvent('2026-08-05', 'game'), teamEvent('2026-10-05', 'game')],
      workDays: [workDay('maya', '2026-10-12')],
      sessions: [august],
    })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 1, updated: 0, unchanged: 0, pruned: 0 })
    expect(Object.keys(state.sessions).sort()).toEqual([sessionIdFor(OTHER_MONTH_DATE), sessionIdFor(D1)].sort())
    expect(state.sessions[august.id]).toBe(august)
  })

  it('orders physios by USER_IDS regardless of workDays insertion order', () => {
    const s = stateWith({ workDays: [workDay('neta', D1), workDay('maya', D1), workDay('shahar', D1)] })
    const { state } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(state.sessions[sessionIdFor(D1)]?.physios).toEqual(['shahar', 'maya', 'neta'])
  })

  it('never mutates its input and always returns a new state / sessions map', () => {
    const existingUpdated = session(D1, { type: 'training', physios: ['maya'] })
    const existingPruned = session(D2)
    const existingKept = session(D3, { notes: { text: 'keep', updatedAt: NOW, updatedBy: 'maya' } })
    const s = deepFreeze(
      stateWith({
        teamEvents: [teamEvent(D1, 'game'), teamEvent('2026-09-25', 'training')],
        workDays: [workDay('maya', D1)],
        sessions: [existingUpdated, existingPruned, existingKept],
      }),
    )
    const snapshot = JSON.stringify(s)

    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 1, updated: 1, unchanged: 1, pruned: 1 })
    expect(JSON.stringify(s)).toBe(snapshot)
    expect(state).not.toBe(s)
    expect(state.sessions).not.toBe(s.sessions)
    // Collections the apply does not own are shared, not copied.
    expect(state.teamEvents).toBe(s.teamEvents)
    expect(state.workDays).toBe(s.workDays)
    expect(state.injuries).toBe(s.injuries)
    expect(state.players).toBe(s.players)

    // Nothing changed at all → still a fresh top-level object.
    const noop = applyMonthlyAttendance(deepFreeze(state), MONTH, LATER, 'maya')
    expect(noop.result).toEqual({ created: 0, updated: 0, unchanged: 3, pruned: 0 })
    expect(noop.state).not.toBe(state)
    expect(noop.state.sessions).toEqual(state.sessions)
  })

  it('covers every day of the month (a fully worked month yields one session per day)', () => {
    const days = monthDays(MONTH)
    const s = stateWith({ workDays: days.map((d) => workDay('shahar', d)) })
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'shahar')
    expect(days).toHaveLength(30)
    expect(result.created).toBe(30)
    expect(Object.keys(state.sessions)).toHaveLength(30)
  })
})

// ------------------------------------------------- review findings (regressions)

describe('generated blank notes never beat real notes when merging (finding 1)', () => {
  it('stamps the blank notes of a created session with BLANK_NOTES_STAMP, older than any real edit', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'training')] })
    const { state } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(getSession(state, D1).notes).toEqual({ text: '', updatedAt: BLANK_NOTES_STAMP, updatedBy: 'maya' })
    expect(BLANK_NOTES_STAMP < NOW).toBe(true)
    // createdAt keeps the real stamp: the merge keeps the earliest creation, so it is safe.
    expect(getSession(state, D1).createdAt).toBe(NOW)
  })

  it('notes typed on one phone survive a LATER apply of the same month on another phone, in both merge directions', () => {
    const cal = stateWith({ teamEvents: [teamEvent(D1, 'training')] })
    const sid = sessionIdFor(D1)
    // Phone A (Maya): apply on Sep 1, then type notes on Sep 3.
    const a1 = applyMonthlyAttendance(cal, MONTH, '2026-09-01T08:00:00.000Z', 'maya').state
    const typed = { text: 'Uri knee sore, taped', updatedAt: '2026-09-03T18:00:00.000Z', updatedBy: 'maya' as const }
    const a2: PersistedState = { ...a1, sessions: { ...a1.sessions, [sid]: { ...getSession(a1, D1), notes: typed } } }
    // Phone B (Shahar): applies the same calendar on Sep 5, AFTER the note was typed.
    const b1 = applyMonthlyAttendance(cal, MONTH, '2026-09-05T08:00:00.000Z', 'shahar').state
    expect(mergeState(a2, b1, 'newest').merged.sessions[sid]?.notes).toEqual(typed)
    expect(mergeState(b1, a2, 'newest').merged.sessions[sid]?.notes).toEqual(typed)
  })
})

describe('tolerates malformed records instead of aborting the whole month (finding 2)', () => {
  /** Smuggle junk past the type checker: these shapes are outside the contract on purpose. */
  const junk = <T>(value: unknown): T => value as T

  it('a session with missing notes on an unbacked date is treated as blank and pruned', () => {
    const s = stateWith({ sessions: [session(D1, { notes: junk(undefined) })] }) // no event, nobody worked
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 1 })
    expect(state.sessions).toEqual({})
  })

  it('a null playerAttendance map or a null attendance entry counts as no attendance data', () => {
    const s = stateWith({
      sessions: [session(D1, { playerAttendance: junk(null) }), session(D2, { playerAttendance: { 'p-a': junk(null) } })],
    })
    const { result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 2 })
  })

  it('a null injury record does not abort the prune check of an orphaned session', () => {
    const s = stateWith({ sessions: [session(D3)] })
    s.injuries['i-1'] = junk(null)
    const { result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 0, updated: 0, unchanged: 0, pruned: 1 })
  })

  it('a session with missing physios is repaired by the refresh instead of crashing the comparison', () => {
    const existing = session(D1, { type: 'training', physios: junk(undefined) })
    const s = stateWith({ teamEvents: [teamEvent(D1, 'training')], workDays: [workDay('maya', D1)], sessions: [existing] })
    const { state, result } = applyMonthlyAttendance(s, MONTH, LATER, 'maya')
    expect(result).toEqual({ created: 0, updated: 1, unchanged: 0, pruned: 0 })
    expect(getSession(state, D1)).toEqual({ ...existing, physios: ['maya'] })
  })

  it('a non-object entry under a session key counts as no session: replaced on a backed date, removed on an unbacked one', () => {
    const s = stateWith({ teamEvents: [teamEvent(D1, 'game')] })
    s.sessions[sessionIdFor(D1)] = junk('junk')
    s.sessions[sessionIdFor(D2)] = junk('junk')
    const { state, result } = applyMonthlyAttendance(s, MONTH, NOW, 'maya')
    expect(result).toEqual({ created: 1, updated: 0, unchanged: 0, pruned: 1 })
    expect(getSession(state, D1)).toEqual({
      id: sessionIdFor(D1),
      date: D1,
      type: 'game',
      physios: [],
      notes: { text: '', updatedAt: BLANK_NOTES_STAMP, updatedBy: 'maya' },
      playerAttendance: {},
      createdAt: NOW,
      createdBy: 'maya',
    })
    expect(state.sessions[sessionIdFor(D2)]).toBeUndefined()
  })
})
