import { describe, expect, it } from 'vitest'
import { homeTarget, initialSyncState, lastSyncDay, latestActivityDate, needsImportReminder, shouldDefaultToPresent } from './sync'
import { emptyPersistedState, type PersistedState, type Session, type SyncStateLike } from './types'

const TODAY = '2026-09-20'

function session(date: string): Session {
  return {
    id: `s-${date}`,
    date,
    type: 'training',
    physios: [],
    notes: { text: '', updatedAt: '2020-01-01T00:00:00.000Z', updatedBy: 'shahar' },
    playerAttendance: {},
    createdAt: '2026-09-01T10:00:00.000Z',
    createdBy: 'maya',
  }
}

function state(over: Partial<PersistedState> = {}): PersistedState {
  return { ...emptyPersistedState(), ...over }
}

function withSync(base: PersistedState, sync: Partial<SyncStateLike> = {}): PersistedState & SyncStateLike {
  return { ...base, ...initialSyncState(), ...sync }
}

describe('latestActivityDate', () => {
  it('is null without any activity', () => {
    expect(latestActivityDate(state(), TODAY)).toBeNull()
  })
  it('takes the newest of sessions, live team events and worked days, ignoring the future and tombstones', () => {
    const s = state({
      sessions: { 's-2026-09-10': session('2026-09-10') },
      teamEvents: {
        '2026-09-15': { id: '2026-09-15', date: '2026-09-15', kind: 'game', updatedAt: 'x', updatedBy: 'shahar' },
        '2026-09-18': { id: '2026-09-18', date: '2026-09-18', kind: 'none', updatedAt: 'x', updatedBy: 'shahar' },
        '2026-09-25': { id: '2026-09-25', date: '2026-09-25', kind: 'training', updatedAt: 'x', updatedBy: 'shahar' },
      },
      workDays: {
        'maya_2026-09-17': { id: 'maya_2026-09-17', userId: 'maya', date: '2026-09-17', worked: false, updatedAt: 'x', updatedBy: 'maya' },
        'neta_2026-09-16': { id: 'neta_2026-09-16', userId: 'neta', date: '2026-09-16', worked: true, updatedAt: 'x', updatedBy: 'neta' },
      },
    })
    expect(latestActivityDate(s, TODAY)).toBe('2026-09-16')
  })
})

describe('lastSyncDay', () => {
  it('is null when never synced, else the local day of the newest stamp', () => {
    expect(lastSyncDay({ lastImport: null, lastExportAt: null })).toBeNull()
    expect(lastSyncDay({ lastImport: { at: '2026-09-18T10:00:00.000Z', by: 'neta', fileName: 'a.json' }, lastExportAt: null })).toBe('2026-09-18')
    expect(lastSyncDay({ lastImport: { at: '2026-09-18T10:00:00.000Z', by: 'neta', fileName: 'a.json' }, lastExportAt: '2026-09-19T10:00:00.000Z' })).toBe('2026-09-19')
    expect(lastSyncDay({ lastImport: { at: 'garbage', by: null, fileName: '' }, lastExportAt: null })).toBeNull()
  })
})

describe('needsImportReminder', () => {
  const withSession = (date: string) => state({ sessions: { [`s-${date}`]: session(date) } })

  it('never reminds a phone without activity', () => {
    expect(needsImportReminder(withSync(state()), TODAY)).toBe(false)
  })
  it('does not nag a never-synced phone on its first day, but does once it has older activity', () => {
    expect(needsImportReminder(withSync(withSession(TODAY)), TODAY)).toBe(false)
    expect(needsImportReminder(withSync(withSession('2026-09-15')), TODAY)).toBe(true)
    // older activity still counts when today is busy too
    const both = state({ sessions: { 's-2026-09-15': session('2026-09-15'), [`s-${TODAY}`]: session(TODAY) } })
    expect(needsImportReminder(withSync(both), TODAY)).toBe(true)
  })
  it('reminds when activity is newer than the last import or export, and not otherwise', () => {
    const imported = { lastImport: { at: '2026-09-16T20:00:00.000Z', by: 'neta' as const, fileName: 'x.json' } }
    expect(needsImportReminder(withSync(withSession('2026-09-18'), imported), TODAY)).toBe(true)
    expect(needsImportReminder(withSync(withSession('2026-09-16'), imported), TODAY)).toBe(false)
    // the phone that exported after the last session is the source of truth, not behind
    expect(needsImportReminder(withSync(withSession('2026-09-18'), { ...imported, lastExportAt: '2026-09-18T21:00:00.000Z' }), TODAY)).toBe(false)
  })
  it('is silenced for the day it was dismissed on', () => {
    expect(needsImportReminder(withSync(withSession('2026-09-15'), { reminderDismissedOn: TODAY }), TODAY)).toBe(false)
    expect(needsImportReminder(withSync(withSession('2026-09-15'), { reminderDismissedOn: '2026-09-19' }), TODAY)).toBe(true)
  })
})

describe('homeTarget', () => {
  it("opens today's session when it exists", () => {
    expect(homeTarget(state({ sessions: { [`s-${TODAY}`]: session(TODAY) } }), TODAY)).toEqual({ path: `/sessions/s-${TODAY}`, applyMonth: null })
  })
  it('creates and opens it when today is a training or game without a session yet', () => {
    const s = state({ teamEvents: { [TODAY]: { id: TODAY, date: TODAY, kind: 'game', updatedAt: 'x', updatedBy: 'shahar' } } })
    expect(homeTarget(s, TODAY)).toEqual({ path: `/sessions/s-${TODAY}`, applyMonth: '2026-09' })
  })
  it('falls back to the calendar on other days (including cleared events)', () => {
    expect(homeTarget(state(), TODAY)).toEqual({ path: '/calendar', applyMonth: null })
    const cleared = state({ teamEvents: { [TODAY]: { id: TODAY, date: TODAY, kind: 'none', updatedAt: 'x', updatedBy: 'shahar' } } })
    expect(homeTarget(cleared, TODAY)).toEqual({ path: '/calendar', applyMonth: null })
  })
})

describe('shouldDefaultToPresent', () => {
  it('applies to today and yesterday only, not to future or older sessions', () => {
    expect(shouldDefaultToPresent(TODAY, TODAY)).toBe(true)
    expect(shouldDefaultToPresent('2026-09-19', TODAY)).toBe(true)
    expect(shouldDefaultToPresent('2026-09-21', TODAY)).toBe(false)
    expect(shouldDefaultToPresent('2026-10-20', TODAY)).toBe(false)
    expect(shouldDefaultToPresent('2026-09-18', TODAY)).toBe(false)
  })
})
