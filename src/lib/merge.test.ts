import { describe, expect, it } from 'vitest'
import { sessionIdFor, workDayIdFor } from './ids'
import { emptyCounts, emptyMergeSummary, ensureSeedPlayers, mergeState, pickNewer, reconcileSessionTypes } from './merge'
import { SEED_EPOCH, SEED_PLAYER_IDS, buildSeedPlayers, seedPlayerId } from './seedPlayers'
import {
  SCHEMA_VERSION,
  emptyPersistedState,
  type AttendanceStatus,
  type DateKey,
  type Injury,
  type Meta,
  type PersistedState,
  type Player,
  type PlayerAttendance,
  type Session,
  type Stamp,
  type TeamEvent,
  type TeamEventKind,
  type UserId,
  type WorkDay,
} from './types'

// ------------------------------------------------------------- fixtures

const T0: Stamp = '2026-09-01T10:00:00.000Z'
const T1: Stamp = '2026-09-02T10:00:00.000Z'
const T2: Stamp = '2026-09-03T10:00:00.000Z'
const T3: Stamp = '2026-09-04T10:00:00.000Z'

const D1: DateKey = '2026-09-19'
const D2: DateKey = '2026-09-20'
const D3: DateKey = '2026-09-21'

function meta(updatedAt: Stamp = T1, updatedBy: UserId = 'maya'): Meta {
  return { updatedAt, updatedBy }
}

function player(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    number: null,
    fitnessLevel: '',
    bodyStructure: '',
    bodyType: '',
    pastInjuries: '',
    rom: '',
    strengthening: '',
    seeded: false,
    deleted: false,
    ...meta(),
    ...over,
  }
}

function teamEvent(date: DateKey, kind: TeamEventKind, m: Meta = meta(T1, 'shahar')): TeamEvent {
  return { id: date, date, kind, ...m }
}

function workDay(userId: UserId, date: DateKey, worked: boolean, m: Meta = meta(T1, userId)): WorkDay {
  return { id: workDayIdFor(userId, date), userId, date, worked, ...m }
}

function injury(id: string, over: Partial<Injury> = {}): Injury {
  return {
    id,
    playerId: 'p-tom-curtis',
    sessionId: null,
    date: D1,
    bodyPart: 'Knee',
    side: 'left',
    severity: 'Low',
    status: 'Active',
    description: '',
    reportedBy: 'maya',
    deleted: false,
    ...meta(),
    ...over,
  }
}

function att(status: AttendanceStatus, updatedAt: Stamp = T1, updatedBy: UserId = 'maya'): PlayerAttendance {
  return { status, updatedAt, updatedBy }
}

/** Default type is 'workday' so a session without a calendar event is already consistent. */
function session(date: DateKey, over: Partial<Session> = {}): Session {
  return {
    id: sessionIdFor(date),
    date,
    type: 'workday',
    physios: ['maya'],
    notes: { text: '', ...meta() },
    playerAttendance: {},
    createdAt: T0,
    createdBy: 'maya',
    ...over,
  }
}

function byId<T extends { id: string }>(...records: T[]): Record<string, T> {
  return Object.fromEntries(records.map((r) => [r.id, r]))
}

/** Full state; seeded players are included unless `seeds: false`. */
function state(over: Partial<PersistedState> = {}, opts: { seeds?: boolean } = {}): PersistedState {
  const seeds = opts.seeds === false ? {} : buildSeedPlayers()
  return { ...emptyPersistedState(), ...over, players: { ...seeds, ...over.players } }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

const counts = (added: number, updated: number, unchanged: number) => ({ added, updated, unchanged })

// ---------------------------------------------------------------- tests

describe('emptyCounts / emptyMergeSummary', () => {
  it('return zeroed, independent objects', () => {
    expect(emptyCounts()).toEqual(counts(0, 0, 0))
    expect(emptyCounts()).not.toBe(emptyCounts())
    const s = emptyMergeSummary()
    expect(s).toEqual({
      players: counts(0, 0, 0),
      teamEvents: counts(0, 0, 0),
      workDays: counts(0, 0, 0),
      sessions: counts(0, 0, 0),
      attendanceEntries: counts(0, 0, 0),
      injuries: counts(0, 0, 0),
      skippedInvalid: 0,
    })
    expect(s.players).not.toBe(s.teamEvents)
  })
})

describe('pickNewer', () => {
  it('greater updatedAt wins regardless of argument order', () => {
    const older = { ...meta(T1, 'neta'), v: 'old' }
    const newer = { ...meta(T2, 'maya'), v: 'new' }
    expect(pickNewer(older, newer)).toBe(newer)
    expect(pickNewer(newer, older)).toBe(newer)
  })

  it('on a stamp tie the greater updatedBy wins regardless of order', () => {
    const maya = { ...meta(T1, 'maya'), v: 'm' }
    const neta = { ...meta(T1, 'neta'), v: 'n' }
    expect(pickNewer(maya, neta)).toBe(neta)
    expect(pickNewer(neta, maya)).toBe(neta)
  })

  it('on a full tie returns the first argument', () => {
    const a = { ...meta(T1, 'maya'), v: 'a' }
    const b = { ...meta(T1, 'maya'), v: 'b' }
    expect(pickNewer(a, b)).toBe(a)
    expect(pickNewer(b, a)).toBe(b)
  })
})

describe('mergeState: flat collections', () => {
  it('add-only union: ids from both sides survive', () => {
    const local = state({ players: byId(player('p-a')) })
    const incoming = state({ players: byId(player('p-b')) })
    const { merged, summary } = mergeState(local, incoming)
    expect(merged.players['p-a']).toEqual(player('p-a'))
    expect(merged.players['p-b']).toEqual(player('p-b'))
    expect(Object.keys(merged.players)).toHaveLength(SEED_PLAYER_IDS.length + 2)
    // p-b added, p-a is local-only (not counted), 14 seeds present on both sides
    expect(summary.players).toEqual(counts(1, 0, SEED_PLAYER_IDS.length))
    expect(merged.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('newer incoming wins and is counted as updated', () => {
    const local = state({ players: byId(player('p-a', { name: 'Old', ...meta(T1, 'maya') })) }, { seeds: false })
    const theirs = player('p-a', { name: 'New', ...meta(T2, 'neta') })
    const incoming = state({ players: byId(theirs) }, { seeds: false })
    const { merged, summary } = mergeState(local, incoming)
    expect(merged.players['p-a']).toEqual(theirs)
    expect(merged.players['p-a']).not.toBe(theirs) // a copy, not an alias of the file
    expect(summary.players).toEqual(counts(0, 1, 0))
  })

  it('older incoming leaves local untouched', () => {
    const mine = player('p-a', { name: 'Mine', ...meta(T2, 'maya') })
    const local = state({ players: byId(mine) }, { seeds: false })
    const incoming = state({ players: byId(player('p-a', { name: 'Stale', ...meta(T1, 'neta') })) }, { seeds: false })
    const { merged, summary } = mergeState(local, incoming)
    expect(merged.players['p-a']).toBe(mine)
    expect(summary.players).toEqual(counts(0, 0, 1))
  })

  it('equal stamps (same updatedBy) → unchanged, local kept', () => {
    const mine = player('p-a', { name: 'Mine', ...meta(T1, 'maya') })
    const local = state({ players: byId(mine) }, { seeds: false })
    const incoming = state({ players: byId(player('p-a', { name: 'Theirs', ...meta(T1, 'maya') })) }, { seeds: false })
    const { merged, summary } = mergeState(local, incoming)
    expect(merged.players['p-a']).toBe(mine)
    expect(summary.players).toEqual(counts(0, 0, 1))
  })

  it("policy 'local' never overwrites existing ids but still adds new ones", () => {
    const mine = player('p-a', { name: 'Mine', ...meta(T1, 'maya') })
    const local = state({ players: byId(mine) }, { seeds: false })
    const incoming = state(
      { players: byId(player('p-a', { name: 'Newer', ...meta(T3, 'neta') }), player('p-b')) },
      { seeds: false },
    )
    const { merged, summary } = mergeState(local, incoming, 'local')
    expect(merged.players['p-a']).toBe(mine)
    expect(merged.players['p-b']).toEqual(player('p-b'))
    expect(summary.players).toEqual(counts(1, 0, 1))
  })

  it('tombstones beat stale live copies in both directions', () => {
    const liveInjury = injury('i-1', { deleted: false, ...meta(T1, 'maya') })
    const deadInjury = injury('i-1', { deleted: true, ...meta(T2, 'neta') })
    const liveEvent = teamEvent(D1, 'training', meta(T1, 'shahar'))
    const clearedEvent = teamEvent(D1, 'none', meta(T2, 'shahar'))
    const workedDay = workDay('maya', D1, true, meta(T1, 'maya'))
    const unmarkedDay = workDay('maya', D1, false, meta(T2, 'maya'))
    const marked = session(D1, { playerAttendance: { 'p-x': att('present', T1, 'maya') } })
    const cleared = session(D1, { playerAttendance: { 'p-x': att('unset', T2, 'maya') } })

    const live = state({
      injuries: byId(liveInjury),
      teamEvents: byId(liveEvent),
      workDays: byId(workedDay),
      sessions: byId(marked),
    })
    const dead = state({
      injuries: byId(deadInjury),
      teamEvents: byId(clearedEvent),
      workDays: byId(unmarkedDay),
      sessions: byId(cleared),
    })

    for (const merged of [mergeState(live, dead).merged, mergeState(dead, live).merged]) {
      expect(merged.injuries['i-1']?.deleted).toBe(true)
      expect(merged.teamEvents[D1]?.kind).toBe('none')
      expect(merged.workDays[workDayIdFor('maya', D1)]?.worked).toBe(false)
      expect(merged.sessions[sessionIdFor(D1)]?.playerAttendance['p-x']?.status).toBe('unset')
      // the un-marked work day also removes maya from the session's physios
      expect(merged.sessions[sessionIdFor(D1)]?.physios).toEqual([])
    }
    expect(mergeState(live, dead).summary.injuries).toEqual(counts(0, 1, 0))
    expect(mergeState(dead, live).summary.injuries).toEqual(counts(0, 0, 1))
  })
})

describe('mergeState: sessions', () => {
  it('a session only in the file is deep-copied and its attendance counts as added', () => {
    const theirs = session(D1, {
      physios: ['neta'],
      playerAttendance: { 'p-a': att('present'), 'p-b': att('absent') },
    })
    const incoming = state({ sessions: byId(theirs) })
    const { merged, summary } = mergeState(state(), incoming)
    const got = merged.sessions[sessionIdFor(D1)]
    expect(got).toEqual(theirs)
    expect(got).not.toBe(theirs)
    expect(got?.physios).not.toBe(theirs.physios)
    expect(got?.notes).not.toBe(theirs.notes)
    expect(got?.playerAttendance).not.toBe(theirs.playerAttendance)
    expect(got?.playerAttendance['p-a']).not.toBe(theirs.playerAttendance['p-a'])
    expect(summary.sessions).toEqual(counts(1, 0, 0))
    expect(summary.attendanceEntries).toEqual(counts(2, 0, 0))
  })

  it('two devices marking different players in the same session both survive', () => {
    const mayaPhone = state({
      sessions: byId(session(D1, { playerAttendance: { 'p-4': att('present', T1, 'maya') } })),
    })
    const netaPhone = state({
      sessions: byId(session(D1, { playerAttendance: { 'p-7': att('injured', T1, 'neta') } })),
    })
    const { merged, summary } = mergeState(mayaPhone, netaPhone)
    const got = merged.sessions[sessionIdFor(D1)]
    expect(got?.playerAttendance).toEqual({
      'p-4': att('present', T1, 'maya'),
      'p-7': att('injured', T1, 'neta'),
    })
    expect(summary.sessions).toEqual(counts(0, 1, 0))
    expect(summary.attendanceEntries).toEqual(counts(1, 0, 0))
  })

  it('notes LWW is independent of attendance LWW', () => {
    const local = state({
      sessions: byId(
        session(D1, {
          notes: { text: 'local notes', ...meta(T2, 'maya') },
          playerAttendance: { 'p-1': att('present', T1, 'maya') },
        }),
      ),
    })
    const incoming = state({
      sessions: byId(
        session(D1, {
          notes: { text: 'stale notes', ...meta(T1, 'neta') },
          playerAttendance: { 'p-1': att('absent', T2, 'neta') },
        }),
      ),
    })
    const got = mergeState(local, incoming).merged.sessions[sessionIdFor(D1)]
    expect(got?.notes).toEqual({ text: 'local notes', ...meta(T2, 'maya') })
    expect(got?.playerAttendance['p-1']).toEqual(att('absent', T2, 'neta'))

    // and the other way round: newer notes from the file, newer attendance locally
    const flipped = mergeState(incoming, local).merged.sessions[sessionIdFor(D1)]
    expect(flipped?.notes).toEqual({ text: 'local notes', ...meta(T2, 'maya') })
    expect(flipped?.playerAttendance['p-1']).toEqual(att('absent', T2, 'neta'))
  })

  it('physios are a union in USER_IDS order', () => {
    const local = state({ sessions: byId(session(D1, { physios: ['neta'] })) })
    const incoming = state({ sessions: byId(session(D1, { physios: ['shahar'] })) })
    expect(mergeState(local, incoming).merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['shahar', 'neta'])
    expect(mergeState(incoming, local).merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['shahar', 'neta'])

    const all = state({ sessions: byId(session(D1, { physios: ['neta', 'maya'] })) })
    const one = state({ sessions: byId(session(D1, { physios: ['maya'] })) })
    expect(mergeState(all, one).merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['maya', 'neta'])
    expect(mergeState(one, all).merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['maya', 'neta'])
  })

  it('createdAt is the minimum and createdBy follows it', () => {
    const local = state({ sessions: byId(session(D1, { createdAt: T2, createdBy: 'maya' })) })
    const incoming = state({ sessions: byId(session(D1, { createdAt: T1, createdBy: 'neta' })) })
    const got = mergeState(local, incoming).merged.sessions[sessionIdFor(D1)]
    expect(got?.createdAt).toBe(T1)
    expect(got?.createdBy).toBe('neta')
    const back = mergeState(incoming, local).merged.sessions[sessionIdFor(D1)]
    expect(back?.createdAt).toBe(T1)
    expect(back?.createdBy).toBe('neta')
  })

  it('a createdAt tie resolves to the greater createdBy in both merge orders', () => {
    const a = state({ sessions: byId(session(D1, { createdAt: T1, createdBy: 'maya' })) })
    const b = state({ sessions: byId(session(D1, { createdAt: T1, createdBy: 'neta' })) })
    const ab = mergeState(a, b)
    const ba = mergeState(b, a)
    expect(ab.merged).toEqual(ba.merged)
    expect(ab.merged.sessions[sessionIdFor(D1)]?.createdAt).toBe(T1)
    expect(ab.merged.sessions[sessionIdFor(D1)]?.createdBy).toBe('neta')
    // a's session changed (its creator flipped); b's did not and keeps its reference
    expect(ab.summary.sessions).toEqual(counts(0, 1, 0))
    expect(ba.summary.sessions).toEqual(counts(0, 0, 1))
    expect(ba.merged.sessions[sessionIdFor(D1)]).toBe(b.sessions[sessionIdFor(D1)])
  })

  it("policy 'local' keeps local notes and attendance but still adds new keys and unions physios", () => {
    const mineNotes = { text: 'mine', ...meta(T1, 'maya') }
    const local = state({
      sessions: byId(
        session(D1, { physios: ['maya'], notes: mineNotes, playerAttendance: { 'p-1': att('present', T1, 'maya') } }),
      ),
    })
    const incoming = state({
      sessions: byId(
        session(D1, {
          physios: ['neta'],
          notes: { text: 'theirs', ...meta(T3, 'neta') },
          playerAttendance: { 'p-1': att('absent', T3, 'neta'), 'p-2': att('present', T3, 'neta') },
        }),
      ),
    })
    const { merged, summary } = mergeState(local, incoming, 'local')
    const got = merged.sessions[sessionIdFor(D1)]
    expect(got?.notes).toBe(mineNotes)
    expect(got?.physios).toEqual(['maya', 'neta'])
    expect(got?.playerAttendance).toEqual({ 'p-1': att('present', T1, 'maya'), 'p-2': att('present', T3, 'neta') })
    expect(summary.attendanceEntries).toEqual(counts(1, 0, 1))
    expect(summary.sessions).toEqual(counts(0, 1, 0))
  })

  it('an identical session on both sides is unchanged and keeps the local reference', () => {
    const mine = session(D1, { physios: ['shahar', 'maya'], playerAttendance: { 'p-1': att('present') } })
    const local = state({ sessions: byId(mine) })
    const incoming = state({
      sessions: byId(session(D1, { physios: ['shahar', 'maya'], playerAttendance: { 'p-1': att('present') } })),
    })
    const { merged, summary } = mergeState(local, incoming)
    expect(merged.sessions[sessionIdFor(D1)]).toBe(mine)
    expect(summary.sessions).toEqual(counts(0, 0, 1))
    expect(summary.attendanceEntries).toEqual(counts(0, 0, 1))
  })
})

describe('session physios follow the merged calendar', () => {
  it('a physio whose work day is tombstoned in the merged calendar is not resurrected by the union', () => {
    // maya worked D1 on the stale phone; on the fresh phone she un-marked it later and re-applied
    const stale = state({
      teamEvents: byId(teamEvent(D1, 'training')),
      workDays: byId(workDay('maya', D1, true, meta(T0, 'maya'))),
      sessions: byId(session(D1, { type: 'training', physios: ['maya'] })),
    })
    const fresh = state({
      teamEvents: byId(teamEvent(D1, 'training')),
      workDays: byId(workDay('maya', D1, false, meta(T2, 'maya'))),
      sessions: byId(session(D1, { type: 'training', physios: [] })),
    })
    for (const merged of [mergeState(fresh, stale).merged, mergeState(stale, fresh).merged]) {
      expect(merged.workDays[workDayIdFor('maya', D1)]?.worked).toBe(false)
      expect(merged.sessions[sessionIdFor(D1)]?.physios).toEqual([])
    }
    expect(mergeState(stale, fresh).summary.sessions).toEqual(counts(0, 1, 0))
    expect(mergeState(fresh, stale).summary.sessions).toEqual(counts(0, 0, 1))

    // re-importing the stale file into the merged result is a no-op (exact counts, no churn)
    const once = mergeState(fresh, stale).merged
    const again = mergeState(once, stale)
    expect(again.merged).toEqual(once)
    expect(again.summary.sessions).toEqual(counts(0, 0, 1))
    expect(again.summary.workDays).toEqual(counts(0, 0, 1))
  })

  it('keeps the union for physios without a work-day record, and a re-marked day keeps the physio', () => {
    // no work-day record at all for anyone on D1 → the union alone decides
    const local = state({ sessions: byId(session(D1, { physios: ['maya'] })) })
    const incoming = state({ sessions: byId(session(D1, { physios: ['neta'] })) })
    expect(mergeState(local, incoming).merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['maya', 'neta'])

    // maya un-marked D1 (T1) and re-marked it later (T2): the live record wins and she stays
    const unmarked = state({
      workDays: byId(workDay('maya', D1, false, meta(T1, 'maya'))),
      sessions: byId(session(D1, { physios: [] })),
    })
    const remarked = state({
      workDays: byId(workDay('maya', D1, true, meta(T2, 'maya'))),
      sessions: byId(session(D1, { physios: ['maya'] })),
    })
    for (const merged of [mergeState(unmarked, remarked).merged, mergeState(remarked, unmarked).merged]) {
      expect(merged.workDays[workDayIdFor('maya', D1)]?.worked).toBe(true)
      expect(merged.sessions[sessionIdFor(D1)]?.physios).toEqual(['maya'])
    }
  })

  it('also cleans sessions present on one side only, in either direction', () => {
    // the file brings the tombstone but no session for that date: the local-only session is cleaned
    const local = state({
      workDays: byId(workDay('maya', D1, true, meta(T0, 'maya'))),
      sessions: byId(session(D1, { physios: ['maya'] })),
    })
    const tombstoneOnly = state({ workDays: byId(workDay('maya', D1, false, meta(T2, 'maya'))) })
    const { merged, summary } = mergeState(local, tombstoneOnly)
    expect(merged.sessions[sessionIdFor(D1)]?.physios).toEqual([])
    expect(summary.workDays).toEqual(counts(0, 1, 0))
    expect(summary.sessions).toEqual(counts(0, 0, 0)) // the file carried no session

    // the file brings a session listing maya, but the local calendar says she un-marked that day
    const localTombstone = state({ workDays: byId(workDay('maya', D2, false, meta(T2, 'maya'))) })
    const fileSession = state({ sessions: byId(session(D2, { physios: ['maya', 'neta'] })) })
    const added = mergeState(localTombstone, fileSession)
    expect(added.merged.sessions[sessionIdFor(D2)]?.physios).toEqual(['neta'])
    expect(added.summary.sessions).toEqual(counts(1, 0, 0))
  })
})

describe('session type reconciliation', () => {
  it('a training→game change on one phone flips the other phone’s session type', () => {
    const phoneA = state({
      teamEvents: byId(teamEvent(D1, 'training', meta(T1, 'shahar'))),
      sessions: byId(session(D1, { type: 'training' })),
    })
    const phoneB = state({
      teamEvents: byId(teamEvent(D1, 'game', meta(T2, 'shahar'))),
      sessions: byId(session(D1, { type: 'game' })),
    })
    // B's newer calendar wins on A ...
    expect(mergeState(phoneA, phoneB).merged.sessions[sessionIdFor(D1)]?.type).toBe('game')
    // ... and A's stale 'training' session does not drag B back
    expect(mergeState(phoneB, phoneA).merged.sessions[sessionIdFor(D1)]?.type).toBe('game')
  })

  it('a cleared event or a date without an event yields a work day', () => {
    const local = state({
      teamEvents: byId(teamEvent(D1, 'game', meta(T1, 'shahar'))),
      sessions: byId(session(D1, { type: 'game' }), session(D2, { type: 'training' })),
    })
    const incoming = state({ teamEvents: byId(teamEvent(D1, 'none', meta(T2, 'shahar'))) })
    const { merged } = mergeState(local, incoming)
    expect(merged.sessions[sessionIdFor(D1)]?.type).toBe('workday')
    expect(merged.sessions[sessionIdFor(D2)]?.type).toBe('workday')
  })

  it('reconcileSessionTypes returns the same reference when nothing changes and never mutates', () => {
    const consistent = deepFreeze(
      state({
        teamEvents: byId(teamEvent(D1, 'training')),
        sessions: byId(session(D1, { type: 'training' }), session(D2, { type: 'workday' })),
      }),
    )
    expect(reconcileSessionTypes(consistent)).toBe(consistent)

    const stale = deepFreeze(state({ sessions: byId(session(D1, { type: 'game' })) }))
    const fixed = reconcileSessionTypes(stale)
    expect(fixed).not.toBe(stale)
    expect(fixed.sessions[sessionIdFor(D1)]?.type).toBe('workday')
    expect(stale.sessions[sessionIdFor(D1)]?.type).toBe('game')
  })
})

describe('seeded players', () => {
  it('missing seeded players are restored, edited or deleted ones are not overwritten', () => {
    const tomId = seedPlayerId('Tom Curtis')
    const uriId = seedPlayerId('Cohen Uri')
    const editedTom = { ...buildSeedPlayers()[tomId]!, fitnessLevel: 'high', ...meta(T2, 'maya') }
    const deletedUri = { ...buildSeedPlayers()[uriId]!, deleted: true, ...meta(T2, 'shahar') }
    const local = state({ players: byId(editedTom, deletedUri) }, { seeds: false })
    const incoming = state({}, { seeds: false })

    const { merged, summary } = mergeState(local, incoming)
    expect(Object.keys(merged.players).sort()).toEqual([...SEED_PLAYER_IDS].sort())
    expect(merged.players[tomId]).toBe(editedTom)
    expect(merged.players[uriId]).toBe(deletedUri)
    for (const id of SEED_PLAYER_IDS) {
      if (id === tomId || id === uriId) continue
      expect(merged.players[id]).toEqual({ ...buildSeedPlayers()[id], updatedAt: SEED_EPOCH })
    }
    // restoring seeds is not an import event: the summary stays empty
    expect(summary.players).toEqual(counts(0, 0, 0))
  })

  it('a real edit to a seeded player wins over the seed in a later merge', () => {
    const tomId = seedPlayerId('Tom Curtis')
    const editedTom = { ...buildSeedPlayers()[tomId]!, number: 99, ...meta(T1, 'neta') }
    const { merged } = mergeState(state(), state({ players: byId(editedTom) }))
    expect(merged.players[tomId]).toEqual(editedTom)
  })

  it('ensureSeedPlayers returns the same reference when nothing is missing', () => {
    const full = deepFreeze(state())
    expect(ensureSeedPlayers(full)).toBe(full)
    const empty = deepFreeze(state({}, { seeds: false }))
    const restored = ensureSeedPlayers(empty)
    expect(Object.keys(restored.players)).toHaveLength(SEED_PLAYER_IDS.length)
    expect(Object.keys(empty.players)).toHaveLength(0)
  })
})

// A fixture pair with conflicts of every kind, including a stamp tie with
// different updatedBy, a createdAt tie with different createdBy, ids on one
// side only, work-day tombstones, and per-field session conflicts.
function conflictingPhones(): [PersistedState, PersistedState] {
  const a = state({
    players: byId(
      player('p-only-a'),
      player('p-x', { name: 'x from a', ...meta(T2, 'maya') }), // a newer
      player('p-y', { name: 'y from a', ...meta(T1, 'maya') }), // b newer
      player('p-z', { name: 'z from a', ...meta(T1, 'maya') }), // tie: 'neta' > 'maya'
    ),
    teamEvents: byId(teamEvent(D1, 'training', meta(T1, 'shahar')), teamEvent(D2, 'game', meta(T2, 'shahar'))),
    workDays: byId(workDay('maya', D1, true, meta(T1, 'maya')), workDay('neta', D1, false, meta(T2, 'neta'))),
    injuries: byId(injury('i-1', { deleted: false, ...meta(T1, 'maya') }), injury('i-2')),
    sessions: byId(
      session(D1, {
        type: 'training',
        physios: ['maya'],
        notes: { text: 'from a', ...meta(T2, 'maya') },
        playerAttendance: {
          'p-only-a': att('present', T1, 'maya'),
          'p-x': att('absent', T1, 'maya'),
          'p-z': att('present', T1, 'maya'),
        },
        createdAt: T1,
        createdBy: 'maya',
      }),
      session(D2, { type: 'game', physios: ['shahar', 'maya'] }),
    ),
  })
  const b = state({
    players: byId(
      player('p-only-b'),
      player('p-x', { name: 'x from b', ...meta(T1, 'neta') }),
      player('p-y', { name: 'y from b', ...meta(T2, 'neta') }),
      player('p-z', { name: 'z from b', ...meta(T1, 'neta') }),
    ),
    teamEvents: byId(teamEvent(D1, 'game', meta(T2, 'shahar')), teamEvent(D3, 'training', meta(T1, 'shahar'))),
    workDays: byId(workDay('maya', D1, false, meta(T2, 'maya')), workDay('shahar', D1, true, meta(T1, 'shahar'))),
    injuries: byId(injury('i-1', { deleted: true, ...meta(T2, 'neta') }), injury('i-3')),
    sessions: byId(
      session(D1, {
        type: 'game',
        physios: ['neta', 'shahar'],
        notes: { text: 'from b', ...meta(T1, 'neta') },
        playerAttendance: {
          'p-only-b': att('injured', T1, 'neta'),
          'p-x': att('present', T2, 'neta'),
          'p-z': att('absent', T1, 'neta'),
        },
        createdAt: T0,
        createdBy: 'neta',
      }),
      // D2 also exists on a with the same createdAt (T0) but createdBy 'maya': a creator tie
      session(D2, { type: 'game', physios: ['shahar'], createdBy: 'shahar' }),
      session(D3, { type: 'training', physios: ['neta'], playerAttendance: { 'p-y': att('present') } }),
    ),
  })
  return [a, b]
}

describe('mergeState: algebraic properties', () => {
  it('is commutative: merged(a,b) deep-equals merged(b,a)', () => {
    const [a, b] = conflictingPhones()
    const ab = mergeState(a, b).merged
    const ba = mergeState(b, a).merged
    expect(ab).toEqual(ba)

    // spot checks of the expected winners
    expect(ab.players['p-x']?.name).toBe('x from a')
    expect(ab.players['p-y']?.name).toBe('y from b')
    expect(ab.players['p-z']?.name).toBe('z from b')
    expect(ab.injuries['i-1']?.deleted).toBe(true)
    expect(ab.teamEvents[D1]?.kind).toBe('game')
    const s1 = ab.sessions[sessionIdFor(D1)]
    expect(s1?.type).toBe('game')
    // the union would be all three, but maya and neta both carry a newer
    // worked=false tombstone for D1 in the merged calendar, so only shahar stays
    expect(s1?.physios).toEqual(['shahar'])
    expect(s1?.notes.text).toBe('from a')
    expect(s1?.playerAttendance).toEqual({
      'p-only-a': att('present', T1, 'maya'),
      'p-only-b': att('injured', T1, 'neta'),
      'p-x': att('present', T2, 'neta'),
      'p-z': att('absent', T1, 'neta'),
    })
    expect(s1?.createdAt).toBe(T0)
    expect(s1?.createdBy).toBe('neta')
    const s2 = ab.sessions[sessionIdFor(D2)]
    expect(s2?.createdAt).toBe(T0)
    expect(s2?.createdBy).toBe('shahar') // createdAt tie: the greater createdBy wins on both phones
    expect(s2?.physios).toEqual(['shahar', 'maya']) // no work-day records on D2: plain union
    expect(ab.sessions[sessionIdFor(D3)]?.type).toBe('training')
  })

  it('is idempotent: merging a state with itself changes nothing', () => {
    const [a, b] = conflictingPhones()
    const x = mergeState(a, b).merged
    const { merged, summary } = mergeState(x, x)
    expect(merged).toEqual(x)
    const size = (m: Record<string, unknown>) => Object.keys(m).length
    expect(summary.players).toEqual(counts(0, 0, size(x.players)))
    expect(summary.teamEvents).toEqual(counts(0, 0, size(x.teamEvents)))
    expect(summary.workDays).toEqual(counts(0, 0, size(x.workDays)))
    expect(summary.injuries).toEqual(counts(0, 0, size(x.injuries)))
    expect(summary.sessions).toEqual(counts(0, 0, size(x.sessions)))
    const attendance = Object.values(x.sessions).reduce((n, s) => n + size(s.playerAttendance), 0)
    expect(summary.attendanceEntries).toEqual(counts(0, 0, attendance))
    expect(summary.skippedInvalid).toBe(0)
  })

  it('re-importing the same file after a merge is a no-op', () => {
    const [a, b] = conflictingPhones()
    const once = mergeState(a, b).merged
    const { merged, summary } = mergeState(once, b)
    expect(merged).toEqual(once)
    expect(summary.players.added + summary.players.updated).toBe(0)
    expect(summary.sessions.added + summary.sessions.updated).toBe(0)
    expect(summary.attendanceEntries.added + summary.attendanceEntries.updated).toBe(0)
  })

  it('never mutates its inputs (deep-frozen inputs, snapshot compare)', () => {
    const [a, b] = conflictingPhones()
    const before = [JSON.stringify(a), JSON.stringify(b)]
    deepFreeze(a)
    deepFreeze(b)
    expect(() => mergeState(a, b)).not.toThrow()
    expect(() => mergeState(b, a, 'local')).not.toThrow()
    expect(() => ensureSeedPlayers(state({}, { seeds: false }))).not.toThrow()
    expect([JSON.stringify(a), JSON.stringify(b)]).toEqual(before)

    // and the merged result does not alias records that came from the file
    const { merged } = mergeState(a, b)
    expect(merged.players['p-y']).not.toBe(b.players['p-y'])
    expect(merged.sessions[sessionIdFor(D3)]).not.toBe(b.sessions[sessionIdFor(D3)])
  })
})

describe('mergeState: summary counts', () => {
  it('are exact for a mixed scenario', () => {
    const local = state(
      {
        players: byId(player('p-keep', meta(T1, 'maya')), player('p-old', meta(T1, 'maya')), player('p-local-only')),
        workDays: byId(workDay('maya', D1, true, meta(T1, 'maya'))),
        injuries: byId(injury('i-same', meta(T1, 'maya'))),
        sessions: byId(
          session(D1, {
            playerAttendance: { 'p-1': att('present', T1, 'maya'), 'p-2': att('present', T1, 'maya') },
          }),
          session(D2, { physios: ['neta'] }),
        ),
      },
      { seeds: false },
    )
    const incoming = state(
      {
        players: byId(
          player('p-keep', meta(T1, 'maya')), // unchanged
          player('p-old', meta(T2, 'neta')), // updated
          player('p-new'), // added
        ),
        teamEvents: byId(teamEvent(D1, 'training')), // added
        workDays: byId(workDay('maya', D1, false, meta(T2, 'maya'))), // updated
        injuries: byId(injury('i-same', meta(T1, 'maya')), injury('i-new')), // unchanged + added
        sessions: byId(
          session(D1, {
            playerAttendance: {
              'p-1': att('present', T1, 'maya'), // unchanged
              'p-2': att('absent', T2, 'neta'), // updated
              'p-3': att('present', T2, 'neta'), // added
            },
          }), // → session updated
          session(D2, { physios: ['neta'] }), // → session unchanged
          session(D3, { playerAttendance: { 'p-1': att('present'), 'p-2': att('absent') } }), // → added, 2 entries
        ),
      },
      { seeds: false },
    )

    const { merged, summary } = mergeState(local, incoming)
    expect(summary).toEqual({
      players: counts(1, 1, 1),
      teamEvents: counts(1, 0, 0),
      workDays: counts(0, 1, 0),
      sessions: counts(1, 1, 1),
      attendanceEntries: counts(3, 1, 1),
      injuries: counts(1, 0, 1),
      skippedInvalid: 0,
    })
    // the calendar event that arrived with the file drives the session type
    expect(merged.sessions[sessionIdFor(D1)]?.type).toBe('training')
    expect(merged.sessions[sessionIdFor(D2)]?.type).toBe('workday')
  })
})
