/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ATTENDANCE_STAMP, sessionIsEmpty } from '../lib/apply'
import { sessionIdFor } from '../lib/ids'
import { SEED_PLAYER_IDS, buildSeedPlayers, seedPlayerId } from '../lib/seedPlayers'
import { SCHEMA_VERSION, emptyPersistedState, type BackupEnvelope, type Injury, type PersistedState, type Player } from '../lib/types'

type StoreModule = typeof import('./useAppStore')
type SelectorsModule = typeof import('./selectors')

const T = '2026-09-19T18:00:00.000Z'
const KEY = 'camels-physio'

/** Map-backed localStorage double; `throwOnSet` mimics a full or blocked store. */
function fakeLocalStorage(initial: Record<string, string> = {}, opts: { throwOnSet?: boolean } = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new DOMException('full', 'QuotaExceededError')
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    dump: () => Object.fromEntries(m),
  }
}

/**
 * The store hydrates and wires its storage listeners at module evaluation, so
 * every scenario imports it fresh under its own `window` (none = no localStorage).
 */
async function loadStore(win?: object): Promise<StoreModule & SelectorsModule> {
  vi.resetModules()
  if (win !== undefined) vi.stubGlobal('window', win)
  const store = await import('./useAppStore')
  const selectors = await import('./selectors')
  return { ...store, ...selectors }
}

function envelope(data: Partial<PersistedState>): BackupEnvelope {
  return { app: 'camels-physio', schemaVersion: SCHEMA_VERSION, exportedAt: T, exportedBy: 'maya', data: { ...emptyPersistedState(), ...data } }
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
    updatedAt: T,
    updatedBy: 'maya',
    ...over,
  }
}

function injury(id: string, playerId: string, over: Partial<Injury> = {}): Injury {
  return {
    id,
    playerId,
    sessionId: null,
    date: '2026-09-19',
    bodyPart: 'Knee',
    side: null,
    severity: 'Medium',
    status: 'Active',
    description: '',
    reportedBy: 'maya',
    deleted: false,
    updatedAt: T,
    updatedBy: 'maya',
    ...over,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ------------------------------------------------------ storage health

describe('storage health at launch', () => {
  it('is healthy and hydrated with a working localStorage', async () => {
    const ls = fakeLocalStorage()
    const { useAppStore } = await loadStore({ localStorage: ls })
    const s = useAppStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.storageHealthy).toBe(true)
    expect(s.storageReset).toBe(false)
    expect(JSON.parse(ls.dump()[KEY] ?? 'null')).toMatchObject({ version: SCHEMA_VERSION })
  })

  it('flags the device as not saving when there is no localStorage at all', async () => {
    const { useAppStore } = await loadStore()
    expect(useAppStore.getState().hydrated).toBe(true)
    expect(useAppStore.getState().storageHealthy).toBe(false)
  })

  it('flags it when the localStorage getter throws (Safari "Block All Cookies")', async () => {
    const { useAppStore } = await loadStore({
      get localStorage() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    expect(useAppStore.getState().hydrated).toBe(true)
    expect(useAppStore.getState().storageHealthy).toBe(false)
  })

  it('flags it when the very first write (during hydration) throws', async () => {
    const { useAppStore } = await loadStore({ localStorage: fakeLocalStorage({}, { throwOnSet: true }) })
    expect(useAppStore.getState().hydrated).toBe(true)
    expect(useAppStore.getState().storageHealthy).toBe(false)
  })

  it('still flags a write that starts failing later in the session', async () => {
    const ls = fakeLocalStorage()
    const { useAppStore } = await loadStore({ localStorage: ls })
    expect(useAppStore.getState().storageHealthy).toBe(true)
    ls.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    useAppStore.getState().setCurrentUser('maya')
    expect(useAppStore.getState().storageHealthy).toBe(false)
  })
})

// ------------------------------------------------ unreadable saved data

describe('unreadable or malformed saved data', () => {
  for (const [label, raw] of [
    ['truncated JSON', '{"state":{"players":'],
    ['an empty string', ''],
  ] as const) {
    it(`sets aside ${label}, starts from seed data and renders instead of staying on the splash`, async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const ls = fakeLocalStorage({ [KEY]: raw })
      const { useAppStore, CORRUPT_STORAGE_KEY } = await loadStore({ localStorage: ls })
      const s = useAppStore.getState()
      expect(s.hydrated).toBe(true)
      expect(s.storageReset).toBe(true)
      expect(s.storageHealthy).toBe(true)
      expect(s.currentUserId).toBeNull()
      expect(Object.keys(s.players).sort()).toEqual([...SEED_PLAYER_IDS].sort())
      expect(ls.dump()[CORRUPT_STORAGE_KEY]).toBe(raw)
      expect(JSON.parse(ls.dump()[KEY] ?? '')).toMatchObject({ version: SCHEMA_VERSION })
      expect(error).toHaveBeenCalledTimes(1)
    })
  }

  it('sanitizes a parseable blob with players: null instead of getting stuck, keeping the other data', async () => {
    const i = injury('i-1', 'p-cohen-uri')
    const raw = JSON.stringify({ state: { players: null, injuries: { 'i-1': i }, currentUserId: 'maya' }, version: SCHEMA_VERSION })
    const { useAppStore } = await loadStore({ localStorage: fakeLocalStorage({ [KEY]: raw }) })
    const s = useAppStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.storageReset).toBe(false)
    expect(s.injuries['i-1']).toEqual(i)
    expect(Object.keys(s.players).sort()).toEqual([...SEED_PLAYER_IDS].sort())
    expect(s.currentUserId).toBe('maya')
  })

  it('validates a blob from a newer app version record by record instead of loading it verbatim', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const raw = JSON.stringify({ state: { players: { x: { id: 'x', name: 42 } }, currentUserId: 'maya' }, version: 7 })
    const { useAppStore } = await loadStore({ localStorage: fakeLocalStorage({ [KEY]: raw }) })
    const s = useAppStore.getState()
    expect(s.hydrated).toBe(true)
    expect(Object.hasOwn(s.players, 'x')).toBe(false)
    expect(Object.keys(s.players).sort()).toEqual([...SEED_PLAYER_IDS].sort())
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('sends a stale currentUserId back to the user gate instead of running as a ghost user', async () => {
    const raw = JSON.stringify({ state: { players: {}, currentUserId: 'shachar' }, version: SCHEMA_VERSION })
    const { useAppStore } = await loadStore({ localStorage: fakeLocalStorage({ [KEY]: raw }) })
    expect(useAppStore.getState().hydrated).toBe(true)
    expect(useAppStore.getState().currentUserId).toBeNull()
    useAppStore.getState().toggleWorkDay('2026-09-19')
    expect(useAppStore.getState().workDays).toEqual({})
  })
})

// --------------------------------------------------------- seed roster

describe('seeded players survive a bad backup', () => {
  const id = seedPlayerId('Cohen Uri')
  const seedTombstone = (over: Partial<Player> = {}): Player => ({ ...buildSeedPlayers()[id]!, deleted: true, updatedAt: T, updatedBy: 'maya', ...over })

  it('revives a seeded player that an imported file tombstoned and restores its seeded flag', async () => {
    const { useAppStore, playersSorted } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    st().importData(envelope({ players: { [id]: seedTombstone({ seeded: false, name: 'Cohen Uri (edited)' }) } }))
    expect(st().players[id]).toMatchObject({ deleted: false, seeded: true, name: 'Cohen Uri (edited)', updatedAt: T })
    expect(playersSorted(st().players)).toHaveLength(SEED_PLAYER_IDS.length)
    expect(st().deletePlayer(id)).toBe(false)
    // The export carries the repaired record, so the next phone converges too.
    expect(st().exportSnapshot().data.players[id]).toMatchObject({ deleted: false, seeded: true })
  })

  it('repairs a tombstoned seed already sitting in localStorage on hydration', async () => {
    const raw = JSON.stringify({ state: { players: { [id]: seedTombstone() }, currentUserId: null }, version: SCHEMA_VERSION })
    const { useAppStore } = await loadStore({ localStorage: fakeLocalStorage({ [KEY]: raw }) })
    expect(useAppStore.getState().players[id]).toMatchObject({ deleted: false, seeded: true })
    expect(Object.keys(useAppStore.getState().players)).toHaveLength(SEED_PLAYER_IDS.length)
  })
})

// ------------------------------------------------------ future stamps

describe('edits on top of a record stamped in the future', () => {
  const FUTURE = '9999-01-01T00:00:00.000Z'

  it('outrank the future stamp, so re-importing the same file does not revert them', async () => {
    const { useAppStore } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    const poisoned = envelope({ players: { 'p-x': player('p-x', { name: 'Poisoned', updatedAt: FUTURE, updatedBy: 'neta' }) } })
    st().importData(poisoned)
    st().updatePlayer('p-x', { name: 'Fixed' })
    expect(st().players['p-x']?.updatedAt).toBe('9999-01-01T00:00:00.001Z')
    const summary = st().importData(poisoned)
    expect(summary.players.unchanged).toBe(1)
    expect(st().players['p-x']?.name).toBe('Fixed')
  })

  it('apply to every stamped record: work days, team events, attendance marks, notes and injuries', async () => {
    const { useAppStore } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('shahar')
    const sid = sessionIdFor('2026-09-19')
    st().importData(
      envelope({
        teamEvents: { '2026-09-19': { id: '2026-09-19', date: '2026-09-19', kind: 'game', updatedAt: FUTURE, updatedBy: 'shahar' } },
        workDays: { 'shahar_2026-09-19': { id: 'shahar_2026-09-19', userId: 'shahar', date: '2026-09-19', worked: true, updatedAt: FUTURE, updatedBy: 'shahar' } },
        sessions: {
          [sid]: {
            id: sid,
            date: '2026-09-19',
            type: 'game',
            physios: ['shahar'],
            notes: { text: 'old', updatedAt: FUTURE, updatedBy: 'shahar' },
            playerAttendance: { 'p-cohen-uri': { status: 'present', updatedAt: FUTURE, updatedBy: 'shahar' } },
            createdAt: T,
            createdBy: 'shahar',
          },
        },
        injuries: { 'i-1': injury('i-1', 'p-cohen-uri', { updatedAt: FUTURE }) },
      }),
    )
    st().cycleTeamEvent('2026-09-19')
    st().toggleWorkDay('2026-09-19')
    st().setPlayerSessionStatus(sid, 'p-cohen-uri', 'absent')
    st().updateSessionNotes(sid, 'new')
    st().updateInjury('i-1', { status: 'Recovered' })
    const s = st()
    const afterFuture = (stamp: string | undefined) => stamp !== undefined && stamp > FUTURE
    expect(afterFuture(s.teamEvents['2026-09-19']?.updatedAt)).toBe(true)
    expect(afterFuture(s.workDays['shahar_2026-09-19']?.updatedAt)).toBe(true)
    expect(afterFuture(s.sessions[sid]?.playerAttendance['p-cohen-uri']?.updatedAt)).toBe(true)
    expect(afterFuture(s.sessions[sid]?.notes.updatedAt)).toBe(true)
    expect(afterFuture(s.injuries['i-1']?.updatedAt)).toBe(true)
    st().deleteInjury('i-1')
    expect(st().injuries['i-1']!.updatedAt > s.injuries['i-1']!.updatedAt).toBe(true)
  })
})

// --------------------------------------------------------- deletePlayer

describe('deletePlayer', () => {
  it("tombstones the player's live injuries so session counts, statistics and the monthly prune agree", async () => {
    const { useAppStore, injuriesForSession, sessionInjuryCount, activeInjuryCountByPlayer, injuryStats } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    const pid = st().addPlayer({ name: 'Temp Guy', number: null })!
    st().toggleWorkDay('2026-09-19')
    expect(st().applyMonthlyAttendance('2026-09').created).toBe(1)
    const sid = sessionIdFor('2026-09-19')
    const iid = st().addInjury({ playerId: pid, sessionId: sid, date: '2026-09-19', bodyPart: 'Knee', side: null, severity: 'Medium', status: 'Active', description: '' })!
    const other = st().addInjury({ playerId: 'p-cohen-uri', sessionId: sid, date: '2026-09-19', bodyPart: 'Ankle', side: 'left', severity: 'Low', status: 'Active', description: '' })!
    expect(sessionInjuryCount(st().injuries, sid)).toBe(2)

    expect(st().deletePlayer(pid)).toBe(true)
    expect(st().players[pid]).toMatchObject({ deleted: true, updatedBy: 'maya' })
    expect(st().injuries[iid]).toMatchObject({ deleted: true, updatedBy: 'maya' })
    expect(st().injuries[other]).toMatchObject({ deleted: false })
    expect(injuriesForSession(st().injuries, sid).map((i) => i.id)).toEqual([other])
    expect(sessionInjuryCount(st().injuries, sid)).toBe(1)
    expect(activeInjuryCountByPlayer(st().injuries)[pid]).toBeUndefined()
    expect(injuryStats(st().injuries, st().players).total).toBe(1)

    // Once the other injury and every mark are gone (reporting an injury also marked
    // each player as injured), the emptied session can be pruned.
    st().deleteInjury(other)
    st().setPlayerSessionStatus(sid, pid, 'unset')
    st().setPlayerSessionStatus(sid, 'p-cohen-uri', 'unset')
    st().toggleWorkDay('2026-09-19')
    expect(sessionIsEmpty(st().sessions[sid]!, st().injuries)).toBe(true)
    expect(st().applyMonthlyAttendance('2026-09').pruned).toBe(1)
    expect(st().sessions[sid]).toBeUndefined()
  })

  it('never deletes a seeded player', async () => {
    const { useAppStore } = await loadStore()
    useAppStore.getState().setCurrentUser('maya')
    expect(useAppStore.getState().deletePlayer(seedPlayerId('Cohen Uri'))).toBe(false)
    expect(useAppStore.getState().players[seedPlayerId('Cohen Uri')]?.deleted).toBe(false)
  })
})

// ---------------------------------------------- addInjury inside a session

describe('addInjury inside a session', () => {
  it('turns an Unset or Present mark (including the default one) into Injured and leaves Absent alone', async () => {
    const { useAppStore } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    st().toggleWorkDay('2026-09-19')
    st().applyMonthlyAttendance('2026-09')
    const sid = sessionIdFor('2026-09-19')
    st().defaultAttendancePresent(sid, SEED_PLAYER_IDS)
    const defaulted = seedPlayerId('Cohen Uri')
    const absent = seedPlayerId('Tom Curtis')
    const unset = seedPlayerId('Shalev Aharoni')
    st().setPlayerSessionStatus(sid, absent, 'absent')
    st().setPlayerSessionStatus(sid, unset, 'unset')
    const fields = { sessionId: sid, date: '2026-09-19', bodyPart: 'Knee', side: null, severity: 'Low', status: 'Active', description: '' } as const
    for (const playerId of [defaulted, absent, unset]) expect(st().addInjury({ playerId, ...fields })).not.toBeNull()

    const att = st().sessions[sid]!.playerAttendance
    expect(att[defaulted]).toMatchObject({ status: 'injured', updatedBy: 'maya' })
    expect(att[defaulted]!.updatedAt > DEFAULT_ATTENDANCE_STAMP).toBe(true)
    expect(att[unset]).toMatchObject({ status: 'injured' })
    expect(att[absent]).toMatchObject({ status: 'absent' })
    for (const id of SEED_PLAYER_IDS) {
      if (![defaulted, absent, unset].includes(id)) expect(att[id]).toMatchObject({ status: 'present', updatedAt: DEFAULT_ATTENDANCE_STAMP })
    }
  })
})

// ------------------------------------------------------ prototype keys

describe('prototype keys are not records', () => {
  it('playerById / sessionById ignore Object.prototype members', async () => {
    const { useAppStore, playerById, sessionById } = await loadStore()
    const s = useAppStore.getState()
    for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(playerById(s.players, k)).toBeUndefined()
      expect(sessionById(s.sessions, k)).toBeUndefined()
    }
    expect(playerById(s.players, undefined)).toBeUndefined()
    expect(playerById(s.players, seedPlayerId('Cohen Uri'))?.name).toBe('Cohen Uri')
  })

  it('store actions refuse them instead of creating id-less records', async () => {
    const { useAppStore } = await loadStore()
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    const before = { ...st().players }
    st().updatePlayer('constructor', { name: 'Ghost' })
    expect(st().players).toEqual(before)
    expect(st().deletePlayer('constructor')).toBe(false)
    expect(st().addInjury({ playerId: 'toString', sessionId: null, date: '2026-09-19', bodyPart: 'Knee', side: null, severity: 'Low', status: 'Active', description: '' })).toBeNull()
    st().setPlayerSessionStatus('constructor', 'p-x', 'present')
    st().updateSessionNotes('__proto__', 'x')
    expect(st().sessions).toEqual({})
    st().updateInjury('constructor', { status: 'Recovered' })
    st().deleteInjury('valueOf')
    expect(st().injuries).toEqual({})
  })
})
