/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, emptyPersistedState, type BackupEnvelope, type PersistedState } from '../lib/types'
import { DEFAULT_ATTENDANCE_STAMP } from '../lib/apply'
import { SEED_PLAYER_IDS, seedPlayerId } from '../lib/seedPlayers'
import { shouldDefaultToPresent } from '../lib/sync'

type StoreModule = typeof import('./useAppStore')

const KEY = 'camels-physio'

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    dump: () => Object.fromEntries(m),
  }
}

/** The store hydrates at module evaluation, so each scenario imports it fresh under its own window. */
async function loadStore(localStorage: ReturnType<typeof fakeLocalStorage>): Promise<StoreModule> {
  vi.resetModules()
  vi.stubGlobal('window', { localStorage })
  return import('./useAppStore')
}

function envelope(data: Partial<PersistedState> = {}, exportedBy: BackupEnvelope['exportedBy'] = 'neta'): BackupEnvelope {
  return { app: 'camels-physio', schemaVersion: SCHEMA_VERSION, exportedAt: '2026-09-19T18:00:00.000Z', exportedBy, data: { ...emptyPersistedState(), ...data } }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('sync bookkeeping', () => {
  it('starts clean and never synced', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const s = useAppStore.getState()
    expect(s.dirtySinceExport).toBe(false)
    expect(s.lastImport).toBeNull()
    expect(s.lastExportAt).toBeNull()
    expect(s.reminderDismissedOn).toBeNull()
  })

  it('every local data change raises the unexported flag; choosing a user does not', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('shahar')
    expect(st().dirtySinceExport).toBe(false)

    const checks: Array<[string, () => void]> = [
      ['toggleWorkDay', () => st().toggleWorkDay('2026-09-20')],
      ['cycleTeamEvent', () => void st().cycleTeamEvent('2026-09-20')],
      ['applyMonthlyAttendance', () => void st().applyMonthlyAttendance('2026-09')],
      ['defaultAttendancePresent', () => st().defaultAttendancePresent('s-2026-09-20', [seedPlayerId('Cohen Uri')])],
      ['updatePlayer', () => st().updatePlayer(seedPlayerId('Cohen Uri'), { fitnessLevel: 'Good' })],
      ['addPlayer', () => void st().addPlayer({ name: 'New Guy', number: 99 })],
      ['setPlayerSessionStatus', () => st().setPlayerSessionStatus('s-2026-09-20', seedPlayerId('Cohen Uri'), 'absent')],
      ['setManyPlayerSessionStatus', () => st().setManyPlayerSessionStatus('s-2026-09-20', [seedPlayerId('Tom Curtis')], 'present')],
      ['updateSessionNotes', () => st().updateSessionNotes('s-2026-09-20', 'hard session')],
      ['addInjury', () => void st().addInjury({ playerId: seedPlayerId('Cohen Uri'), sessionId: 's-2026-09-20', date: '2026-09-20', bodyPart: 'Knee', side: null, severity: 'Low', status: 'Active', description: '' })],
    ]
    for (const [name, run] of checks) {
      st().markExported()
      expect(st().dirtySinceExport, `before ${name}`).toBe(false)
      run()
      expect(st().dirtySinceExport, `after ${name}`).toBe(true)
    }
    // a no-op apply (nothing to create/refresh/prune) leaves a clean phone clean
    st().markExported()
    st().applyMonthlyAttendance('2026-09')
    expect(st().dirtySinceExport).toBe(false)
  })

  it('markExported clears the flag and stamps the export time', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    st().toggleWorkDay('2026-09-20')
    st().markExported()
    expect(st().dirtySinceExport).toBe(false)
    expect(st().lastExportAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('importData remembers who sent the file and its name, without raising the unexported flag', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    st().importData(envelope({}, 'neta'), 'newest', 'camels-physio_2026-09-19_2130_neta.json')
    expect(st().lastImport).toEqual({ at: expect.stringMatching(/T/), by: 'neta', fileName: 'camels-physio_2026-09-19_2130_neta.json' })
    expect(st().dirtySinceExport).toBe(false)
  })

  it('setManyPlayerSessionStatus writes every player in one go with fresh stamps', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('neta')
    st().toggleWorkDay('2026-09-20')
    st().applyMonthlyAttendance('2026-09')
    const ids = [seedPlayerId('Cohen Uri'), seedPlayerId('Tom Curtis')]
    st().setManyPlayerSessionStatus('s-2026-09-20', ids, 'present')
    const att = st().sessions['s-2026-09-20']!.playerAttendance
    expect(Object.keys(att).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(att[id]).toMatchObject({ status: 'present', updatedBy: 'neta' })
  })

  it('default present marks never beat a real mark from another phone, even an earlier one', async () => {
    const A = (await loadStore(fakeLocalStorage())).useAppStore
    const B = (await loadStore(fakeLocalStorage())).useAppStore
    const sid = 's-2026-09-20'
    const cohen = seedPlayerId('Cohen Uri')
    const tom = seedPlayerId('Tom Curtis')

    // 17:30 — phone B (Neta) marks Cohen absent and exports.
    vi.useFakeTimers({ now: new Date('2026-09-20T17:30:00.000Z') })
    B.getState().setCurrentUser('neta')
    B.getState().toggleWorkDay('2026-09-20')
    B.getState().applyMonthlyAttendance('2026-09')
    B.getState().setPlayerSessionStatus(sid, cohen, 'absent')
    const fromB = B.getState().exportSnapshot()

    // 18:00 — phone A (Shahar) opens today's session before importing: everyone defaults to present.
    vi.setSystemTime(new Date('2026-09-20T18:00:00.000Z'))
    A.getState().setCurrentUser('shahar')
    A.getState().toggleWorkDay('2026-09-20')
    A.getState().applyMonthlyAttendance('2026-09')
    A.getState().markExported()
    A.getState().defaultAttendancePresent(sid, SEED_PLAYER_IDS)
    expect(A.getState().sessions[sid]!.playerAttendance[cohen]).toEqual({ status: 'present', updatedAt: DEFAULT_ATTENDANCE_STAMP, updatedBy: 'shahar' })
    expect(A.getState().dirtySinceExport).toBe(true)

    // A imports B: the real (earlier) absence wins, the defaults fill the gaps.
    A.getState().importData(fromB, 'newest')
    expect(A.getState().sessions[sid]!.playerAttendance[cohen]).toMatchObject({ status: 'absent', updatedBy: 'neta' })
    expect(A.getState().sessions[sid]!.playerAttendance[tom]).toMatchObject({ status: 'present', updatedAt: DEFAULT_ATTENDANCE_STAMP })

    // B imports A: still absent on B, the defaults arrive for the rest.
    B.getState().importData(A.getState().exportSnapshot(), 'newest')
    expect(B.getState().sessions[sid]!.playerAttendance[cohen]).toMatchObject({ status: 'absent', updatedBy: 'neta' })
    expect(B.getState().sessions[sid]!.playerAttendance[tom]).toMatchObject({ status: 'present', updatedAt: DEFAULT_ATTENDANCE_STAMP })

    // A real tap on top of a default mark takes the real time and wins from then on.
    A.getState().setPlayerSessionStatus(sid, tom, 'absent')
    const tapped = A.getState().sessions[sid]!.playerAttendance[tom]!
    expect(tapped.updatedAt > DEFAULT_ATTENDANCE_STAMP).toBe(true)
    expect(tapped.updatedAt).toBe('2026-09-20T18:00:00.000Z')
  })

  it('defaultAttendancePresent leaves a session with any mark alone', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('maya')
    st().toggleWorkDay('2026-09-20')
    st().applyMonthlyAttendance('2026-09')
    const cohen = seedPlayerId('Cohen Uri')
    st().setPlayerSessionStatus('s-2026-09-20', cohen, 'unset')
    st().markExported()
    st().defaultAttendancePresent('s-2026-09-20', SEED_PLAYER_IDS)
    expect(Object.keys(st().sessions['s-2026-09-20']!.playerAttendance)).toEqual([cohen])
    expect(st().dirtySinceExport).toBe(false)
  })

  it('a future session is never defaulted, so it can still be pruned when the calendar changes', async () => {
    const { useAppStore } = await loadStore(fakeLocalStorage())
    const st = () => useAppStore.getState()
    st().setCurrentUser('shahar')
    st().cycleTeamEvent('2026-09-27') // training next week
    expect(st().applyMonthlyAttendance('2026-09').created).toBe(1)
    // The rule the session page follows: nothing is written for a future date...
    expect(shouldDefaultToPresent('2026-09-27', '2026-09-20')).toBe(false)
    expect(st().sessions['s-2026-09-27']!.playerAttendance).toEqual({})
    // ...so cancelling the training removes the session instead of leaving a ghost roll call.
    st().cycleTeamEvent('2026-09-27') // game
    st().cycleTeamEvent('2026-09-27') // none
    expect(st().applyMonthlyAttendance('2026-09').pruned).toBe(1)
    expect(st().sessions['s-2026-09-27']).toBeUndefined()
  })

  it('sync fields survive a reload and are never part of the export', async () => {
    const ls = fakeLocalStorage()
    const first = await loadStore(ls)
    first.useAppStore.getState().setCurrentUser('maya')
    first.useAppStore.getState().importData(envelope({}, 'shahar'), 'newest', 'a.json')
    first.useAppStore.getState().toggleWorkDay('2026-09-20')
    first.useAppStore.getState().dismissImportReminder('2026-09-20')

    const second = await loadStore(fakeLocalStorage(ls.dump()))
    const s = second.useAppStore.getState()
    expect(s.lastImport?.by).toBe('shahar')
    expect(s.dirtySinceExport).toBe(true)
    expect(s.reminderDismissedOn).toBe('2026-09-20')
    const exported = s.exportSnapshot() as unknown as Record<string, unknown>
    expect(Object.keys(exported.data as object)).toEqual(['schemaVersion', 'players', 'teamEvents', 'workDays', 'sessions', 'injuries'])
  })

  it('ignores junk sync fields in saved data', async () => {
    const ls = fakeLocalStorage()
    const first = await loadStore(ls)
    first.useAppStore.getState().setCurrentUser('maya')
    const blob = JSON.parse(ls.dump()[KEY]!) as { state: Record<string, unknown> }
    blob.state.lastImport = { at: 42, by: 'someone' }
    blob.state.lastExportAt = ''
    blob.state.dirtySinceExport = 'yes'
    blob.state.reminderDismissedOn = '2026-13-45'
    const second = await loadStore(fakeLocalStorage({ [KEY]: JSON.stringify(blob) }))
    const s = second.useAppStore.getState()
    expect(s.lastImport).toBeNull()
    expect(s.lastExportAt).toBeNull()
    expect(s.dirtySinceExport).toBe(false)
    expect(s.reminderDismissedOn).toBeNull()
  })
})
