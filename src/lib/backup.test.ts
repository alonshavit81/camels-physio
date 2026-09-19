import { describe, expect, it } from 'vitest'
import {
  ERR_NOT_BACKUP,
  ERR_NOT_JSON,
  backupFilename,
  buildExport,
  migratePersisted,
  parseBackupText,
  sanitizeState,
  serializeExport,
} from './backup'
import { SCHEMA_VERSION } from './types'
import type { BackupEnvelope, ParseResult, PersistedState } from './types'

const T = '2026-09-19T18:30:00.000Z'
const T2 = '2026-09-19T19:00:00.000Z'

/** A small but complete state: one of every record type, with Hebrew text. */
function fixtureState(): PersistedState {
  return {
    schemaVersion: 1,
    players: {
      'p-cohen-uri': {
        id: 'p-cohen-uri',
        name: 'Cohen Uri',
        number: 33,
        fitnessLevel: 'good',
        bodyStructure: '',
        bodyType: 'Athletic',
        pastInjuries: 'שלום',
        rom: '',
        strengthening: '',
        seeded: true,
        deleted: false,
        updatedAt: T,
        updatedBy: 'shahar',
      },
      'p-abc': {
        id: 'p-abc',
        name: 'Manual Guy',
        number: null,
        fitnessLevel: '',
        bodyStructure: '',
        bodyType: '',
        pastInjuries: '',
        rom: '',
        strengthening: '',
        seeded: false,
        deleted: false,
        updatedAt: T2,
        updatedBy: 'maya',
      },
    },
    teamEvents: {
      '2026-09-19': { id: '2026-09-19', date: '2026-09-19', kind: 'game', updatedAt: T, updatedBy: 'shahar' },
    },
    workDays: {
      'maya_2026-09-19': { id: 'maya_2026-09-19', userId: 'maya', date: '2026-09-19', worked: true, updatedAt: T, updatedBy: 'maya' },
    },
    sessions: {
      's-2026-09-19': {
        id: 's-2026-09-19',
        date: '2026-09-19',
        type: 'game',
        physios: ['maya'],
        notes: { text: 'שלום עולם', updatedAt: T, updatedBy: 'maya' },
        playerAttendance: { 'p-cohen-uri': { status: 'present', updatedAt: T, updatedBy: 'maya' } },
        createdAt: T,
        createdBy: 'maya',
      },
    },
    injuries: {
      'i-1': {
        id: 'i-1',
        playerId: 'p-cohen-uri',
        sessionId: 's-2026-09-19',
        date: '2026-09-19',
        bodyPart: 'Knee',
        side: 'left',
        severity: 'Medium',
        status: 'Active',
        description: 'twist',
        reportedBy: 'maya',
        deleted: false,
        updatedAt: T,
        updatedBy: 'maya',
      },
    },
  }
}

function expectOk(r: ParseResult): { envelope: BackupEnvelope; skipped: number } {
  if (!r.ok) throw new Error(`expected ok, got error: ${r.error}`)
  return r
}

function expectError(r: ParseResult): string {
  if (r.ok) throw new Error('expected an error, got ok')
  return r.error
}

const meta = { updatedAt: T, updatedBy: 'maya' }

// ---------------------------------------------------------------- export

describe('buildExport / serializeExport', () => {
  it('roundtrips through serializeExport and parseBackupText with identical data', () => {
    const state = fixtureState()
    const env = buildExport(state, 'maya', T)
    expect(env.app).toBe('camels-physio')
    expect(env.schemaVersion).toBe(SCHEMA_VERSION)
    expect(env.exportedAt).toBe(T)
    expect(env.exportedBy).toBe('maya')

    const text = serializeExport(env)
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
    expect(text.startsWith('{')).toBe(true)

    const parsed = expectOk(parseBackupText(text))
    expect(parsed.skipped).toBe(0)
    expect(parsed.envelope.exportedAt).toBe(T)
    expect(parsed.envelope.exportedBy).toBe('maya')
    expect(parsed.envelope.data).toEqual(state)
  })

  it('exports only the five collections plus schemaVersion, stripping device-only keys', () => {
    const wide = { ...fixtureState(), currentUserId: 'maya', hydrated: true }
    const env = buildExport(wide, null, T)
    expect(Object.keys(env.data).sort()).toEqual(['injuries', 'players', 'schemaVersion', 'sessions', 'teamEvents', 'workDays'])
    expect(env.exportedBy).toBeNull()
    expect(serializeExport(env)).not.toContain('currentUserId')
    expect(serializeExport(env)).not.toContain('hydrated')
  })

  it('does not mutate the input state', () => {
    const state = fixtureState()
    const snapshot = JSON.stringify(state)
    buildExport(state, 'neta', T)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('keeps Hebrew text intact through serialize → parse', () => {
    const text = serializeExport(buildExport(fixtureState(), 'maya', T))
    expect(text).toContain('שלום')
    const parsed = expectOk(parseBackupText(text))
    expect(parsed.envelope.data.sessions['s-2026-09-19']?.notes.text).toBe('שלום עולם')
    expect(parsed.envelope.data.players['p-cohen-uri']?.pastInjuries).toBe('שלום')
  })
})

describe('backupFilename', () => {
  it('formats date, time and a slugified lower-case user name', () => {
    const d = new Date(2026, 8, 19, 21, 30) // local time, 19 Sep 2026 21:30
    expect(backupFilename(d, 'Maya')).toBe('camels-physio_2026-09-19_2130_maya.json')
  })

  it('zero-pads the time and slugifies spaces', () => {
    const d = new Date(2026, 0, 5, 7, 5)
    expect(backupFilename(d, 'Shahar Ben David')).toBe('camels-physio_2026-01-05_0705_shahar-ben-david.json')
  })

  it("falls back to 'unknown' for empty or non-Latin names", () => {
    const d = new Date(2026, 8, 19, 21, 30)
    expect(backupFilename(d, '')).toBe('camels-physio_2026-09-19_2130_unknown.json')
    expect(backupFilename(d, '   ')).toBe('camels-physio_2026-09-19_2130_unknown.json')
    expect(backupFilename(d, 'מאיה')).toBe('camels-physio_2026-09-19_2130_unknown.json')
    // mixed: only the Latin part survives
    expect(backupFilename(d, 'Maya מאיה')).toBe('camels-physio_2026-09-19_2130_maya.json')
  })
})

// ----------------------------------------------------------------- parse

describe('parseBackupText: input handling', () => {
  it('strips a leading BOM', () => {
    const text = '﻿' + serializeExport(buildExport(fixtureState(), 'neta', T))
    const parsed = expectOk(parseBackupText(text))
    expect(parsed.envelope.data).toEqual(fixtureState())
  })

  it('rejects invalid JSON with a clear message', () => {
    expect(expectError(parseBackupText('{ not json'))).toBe(ERR_NOT_JSON)
    expect(expectError(parseBackupText(''))).toBe(ERR_NOT_JSON)
    expect(expectError(parseBackupText('This file is not valid JSON.'))).toBe('This file is not valid JSON.')
  })

  it('rejects JSON that is not a backup', () => {
    expect(expectError(parseBackupText('{}'))).toBe(ERR_NOT_BACKUP)
    expect(expectError(parseBackupText('[]'))).toBe(ERR_NOT_BACKUP)
    expect(expectError(parseBackupText('"hello"'))).toBe(ERR_NOT_BACKUP)
    expect(expectError(parseBackupText('null'))).toBe(ERR_NOT_BACKUP)
    expect(expectError(parseBackupText('42'))).toBe(ERR_NOT_BACKUP)
    expect(ERR_NOT_BACKUP).toBe('This file is not a Camels Physio backup.')
  })

  it('rejects an envelope from another app', () => {
    const other = { app: 'other', schemaVersion: 1, exportedAt: T, exportedBy: 'maya', data: fixtureState() }
    expect(expectError(parseBackupText(JSON.stringify(other)))).toBe(ERR_NOT_BACKUP)
  })

  it('rejects an envelope whose data has no collections', () => {
    const env = { app: 'camels-physio', schemaVersion: 1, exportedAt: T, exportedBy: 'maya', data: { foo: 1 } }
    expect(expectError(parseBackupText(JSON.stringify(env)))).toBe(ERR_NOT_BACKUP)
  })
})

describe('parseBackupText: accepted shapes', () => {
  it('accepts a raw PersistedState', () => {
    const parsed = expectOk(parseBackupText(JSON.stringify(fixtureState())))
    expect(parsed.envelope.app).toBe('camels-physio')
    expect(parsed.envelope.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.envelope.exportedAt).toBe('')
    expect(parsed.envelope.exportedBy).toBeNull()
    expect(parsed.envelope.data).toEqual(fixtureState())
    expect(parsed.skipped).toBe(0)
  })

  it('accepts a raw state with only some collections (missing ones become empty)', () => {
    const partial = { players: fixtureState().players }
    const parsed = expectOk(parseBackupText(JSON.stringify(partial)))
    expect(parsed.envelope.data.players).toEqual(fixtureState().players)
    expect(parsed.envelope.data.teamEvents).toEqual({})
    expect(parsed.envelope.data.workDays).toEqual({})
    expect(parsed.envelope.data.sessions).toEqual({})
    expect(parsed.envelope.data.injuries).toEqual({})
  })

  it('accepts a Zustand persist wrapper (raw localStorage) and ignores device-only keys', () => {
    const wrapper = { state: { ...fixtureState(), currentUserId: 'neta', hydrated: true }, version: 1 }
    const parsed = expectOk(parseBackupText(JSON.stringify(wrapper)))
    expect(parsed.envelope.data).toEqual(fixtureState())
    expect(parsed.envelope.exportedBy).toBeNull()
    expect('currentUserId' in parsed.envelope.data).toBe(false)
  })

  it('normalises the envelope fields: exportedAt must be a string, exportedBy a known user', () => {
    const env = { app: 'camels-physio', schemaVersion: 1, exportedAt: 12345, exportedBy: 'someone', data: fixtureState() }
    const parsed = expectOk(parseBackupText(JSON.stringify(env)))
    expect(parsed.envelope.exportedAt).toBe('')
    expect(parsed.envelope.exportedBy).toBeNull()
  })

  it('defaults the schema version to 1 when absent', () => {
    const env = { app: 'camels-physio', exportedAt: T, exportedBy: 'maya', data: { players: {} } }
    const parsed = expectOk(parseBackupText(JSON.stringify(env)))
    expect(parsed.envelope.schemaVersion).toBe(1)
  })
})

describe('parseBackupText: schema versions', () => {
  it('rejects a future schema version with the exact message', () => {
    const env = { ...buildExport(fixtureState(), 'maya', T), schemaVersion: 2 }
    expect(expectError(parseBackupText(JSON.stringify(env)))).toBe(
      'This backup was made by a newer app version (schema 2). Please update the app, then import again.',
    )
  })

  it('rejects a future version in the persist wrapper too', () => {
    const wrapper = { state: fixtureState(), version: 7 }
    expect(expectError(parseBackupText(JSON.stringify(wrapper)))).toBe(
      'This backup was made by a newer app version (schema 7). Please update the app, then import again.',
    )
  })

  it('accepts an older version (0) by running it through the migration path', () => {
    const env = { ...buildExport(fixtureState(), 'maya', T), schemaVersion: 0 }
    const parsed = expectOk(parseBackupText(JSON.stringify(env)))
    expect(parsed.envelope.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.envelope.data.schemaVersion).toBe(SCHEMA_VERSION)
    expect(parsed.envelope.data).toEqual(fixtureState())
  })
})

describe('migratePersisted', () => {
  it('is the identity for the current version', () => {
    const raw = { players: {} }
    expect(migratePersisted(raw, SCHEMA_VERSION)).toBe(raw)
  })

  it('returns unknown older versions unchanged', () => {
    const raw = { players: {} }
    expect(migratePersisted(raw, 0)).toBe(raw)
    expect(migratePersisted(raw, -3)).toBe(raw)
    expect(migratePersisted(raw, Number.NaN)).toBe(raw)
  })
})

// -------------------------------------------------------------- sanitize

describe('sanitizeState: shape', () => {
  it('returns null for non-objects and objects without any collection map', () => {
    expect(sanitizeState(null)).toBeNull()
    expect(sanitizeState('x')).toBeNull()
    expect(sanitizeState([])).toBeNull()
    expect(sanitizeState({})).toBeNull()
    expect(sanitizeState({ players: [] })).toBeNull() // arrays are not maps
    expect(sanitizeState({ players: 'nope', schemaVersion: 1 })).toBeNull()
  })

  it('treats missing collections as empty when at least one is present', () => {
    const r = sanitizeState({ injuries: {} })
    expect(r).not.toBeNull()
    expect(r?.state).toEqual({ schemaVersion: 1, players: {}, teamEvents: {}, workDays: {}, sessions: {}, injuries: {} })
    expect(r?.skipped).toBe(0)
  })

  it('never mutates the input', () => {
    const raw = { players: { x: { name: 'X', number: '7', updatedAt: T, updatedBy: 'maya' } } }
    const snapshot = JSON.stringify(raw)
    sanitizeState(raw)
    expect(JSON.stringify(raw)).toBe(snapshot)
  })
})

describe('sanitizeState: invalid records are skipped and counted, valid ones survive', () => {
  it('drops one bad player, one bad team event kind and one bad attendance entry', () => {
    const state = fixtureState()
    const raw = {
      ...state,
      players: {
        ...state.players,
        'p-bad': { id: 'p-bad', name: 'Bad', number: 1, updatedAt: T, updatedBy: 'nobody' },
      },
      teamEvents: {
        ...state.teamEvents,
        '2026-09-20': { id: '2026-09-20', date: '2026-09-20', kind: 'party', ...meta },
      },
      sessions: {
        's-2026-09-19': {
          ...state.sessions['s-2026-09-19'],
          playerAttendance: {
            ...state.sessions['s-2026-09-19']?.playerAttendance,
            'p-abc': { status: 'maybe', ...meta },
          },
        },
      },
    }
    const r = sanitizeState(raw)
    expect(r).not.toBeNull()
    expect(r?.skipped).toBe(3)
    expect(r?.state).toEqual(state)
  })

  it('reports the same skipped count through parseBackupText', () => {
    const raw = {
      players: { ok: fixtureState().players['p-abc'], bad: { id: 'p-x', name: 'no meta' } },
      injuries: { 'i-bad': { id: 'i-bad', playerId: '', date: '2026-09-19', ...meta } },
    }
    const parsed = expectOk(parseBackupText(JSON.stringify(raw)))
    expect(parsed.skipped).toBe(2)
    expect(Object.keys(parsed.envelope.data.players)).toEqual(['p-abc'])
    expect(parsed.envelope.data.injuries).toEqual({})
  })

  it('drops non-object entries and entries with bad Meta', () => {
    const raw = {
      workDays: {
        a: null,
        b: 'string',
        c: { userId: 'maya', date: '2026-09-19', worked: true, updatedAt: '', updatedBy: 'maya' },
        d: { userId: 'maya', date: '2026-09-19', worked: true, updatedAt: T, updatedBy: 'x' },
        e: { userId: 'maya', date: '2026-09-19', worked: true, ...meta },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(4)
    expect(Object.keys(r?.state.workDays ?? {})).toEqual(['maya_2026-09-19'])
  })
})

describe('sanitizeState: players', () => {
  it('coerces a numeric-string jersey number and nulls anything else', () => {
    const base = { name: 'X', ...meta }
    const raw = {
      players: {
        a: { id: 'a', ...base, number: '7' },
        b: { id: 'b', ...base, number: ' 12 ' },
        c: { id: 'c', ...base, number: 'abc' },
        d: { id: 'd', ...base, number: 1000 },
        e: { id: 'e', ...base, number: 3.5 },
        f: { id: 'f', ...base, number: -1 },
        g: { id: 'g', ...base, number: 0 },
        h: { id: 'h', ...base },
      },
    }
    const p = sanitizeState(raw)?.state.players
    expect(p?.a?.number).toBe(7)
    expect(p?.b?.number).toBe(12)
    expect(p?.c?.number).toBeNull()
    expect(p?.d?.number).toBeNull()
    expect(p?.e?.number).toBeNull()
    expect(p?.f?.number).toBeNull()
    expect(p?.g?.number).toBe(0)
    expect(p?.h?.number).toBeNull()
  })

  it('fills defaults: empty strings, bodyType, seeded by SEED_PLAYER_IDS, deleted false', () => {
    const raw = {
      players: {
        'p-cohen-uri': { id: 'p-cohen-uri', name: 'Cohen Uri', bodyType: 'Weird', ...meta },
        'p-manual': { id: 'p-manual', name: 'M', bodyType: 'Strong', ...meta },
      },
    }
    const p = sanitizeState(raw)?.state.players
    expect(p?.['p-cohen-uri']).toEqual({
      id: 'p-cohen-uri',
      name: 'Cohen Uri',
      number: null,
      fitnessLevel: '',
      bodyStructure: '',
      bodyType: '',
      pastInjuries: '',
      rom: '',
      strengthening: '',
      seeded: true,
      deleted: false,
      ...meta,
    })
    expect(p?.['p-manual']?.bodyType).toBe('Strong')
    expect(p?.['p-manual']?.seeded).toBe(false)
    expect(p?.['p-manual']?.deleted).toBe(false)
  })

  it('re-keys the map by the record id and drops unknown keys from records', () => {
    const raw = {
      players: {
        'wrong-key': { id: 'p-right', name: 'R', extra: 'junk', ...meta },
      },
    }
    const p = sanitizeState(raw)?.state.players
    expect(Object.keys(p ?? {})).toEqual(['p-right'])
    expect(p?.['p-right']?.id).toBe('p-right')
    expect('extra' in (p?.['p-right'] ?? {})).toBe(false)
  })
})

describe('sanitizeState: team events and work days', () => {
  it('derives a missing team-event id from the date and rejects a mismatched one', () => {
    const raw = {
      teamEvents: {
        '2026-09-19': { date: '2026-09-19', kind: 'training', ...meta },
        '2026-09-20': { id: '2026-09-21', date: '2026-09-20', kind: 'training', ...meta },
        '2026-09-31': { date: '2026-09-31', kind: 'game', ...meta }, // impossible date
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(2)
    expect(r?.state.teamEvents).toEqual({ '2026-09-19': { id: '2026-09-19', date: '2026-09-19', kind: 'training', ...meta } })
  })

  it('re-keys a team event stored under the wrong date key', () => {
    const raw = { teamEvents: { oops: { id: '2026-09-19', date: '2026-09-19', kind: 'none', ...meta } } }
    expect(Object.keys(sanitizeState(raw)?.state.teamEvents ?? {})).toEqual(['2026-09-19'])
  })

  it('derives work-day ids, defaults worked to true and validates the user', () => {
    const raw = {
      workDays: {
        a: { userId: 'neta', date: '2026-09-19', ...meta },
        b: { id: 'neta_2026-09-19', userId: 'maya', date: '2026-09-19', worked: false, ...meta },
        c: { userId: 'someone', date: '2026-09-19', ...meta },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(2)
    expect(r?.state.workDays).toEqual({
      'neta_2026-09-19': { id: 'neta_2026-09-19', userId: 'neta', date: '2026-09-19', worked: true, ...meta },
    })
  })
})

describe('sanitizeState: sessions', () => {
  it('derives the id, defaults the type, filters/dedupes/orders physios and defaults notes', () => {
    const raw = {
      sessions: {
        x: {
          date: '2026-09-19',
          type: 'party',
          physios: ['neta', 'bogus', 'shahar', 'neta', 42],
          playerAttendance: 'nope',
          createdAt: T,
          createdBy: 'neta',
        },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(0)
    expect(r?.state.sessions).toEqual({
      's-2026-09-19': {
        id: 's-2026-09-19',
        date: '2026-09-19',
        type: 'workday',
        physios: ['shahar', 'neta'],
        notes: { text: '', updatedAt: T, updatedBy: 'neta' },
        playerAttendance: {},
        createdAt: T,
        createdBy: 'neta',
      },
    })
  })

  it('defaults createdAt/createdBy from the notes Meta', () => {
    const raw = {
      sessions: {
        's-2026-09-19': { id: 's-2026-09-19', date: '2026-09-19', type: 'training', physios: [], notes: { text: 'hi', updatedAt: T2, updatedBy: 'maya' } },
      },
    }
    const s = sanitizeState(raw)?.state.sessions['s-2026-09-19']
    expect(s?.createdAt).toBe(T2)
    expect(s?.createdBy).toBe('maya')
    expect(s?.notes).toEqual({ text: 'hi', updatedAt: T2, updatedBy: 'maya' })
  })

  it('drops a session when neither notes Meta nor createdAt/createdBy is usable', () => {
    const raw = {
      sessions: {
        a: { date: '2026-09-19', notes: { text: 'x' } },
        b: { date: '2026-09-19', notes: { text: 'x', updatedAt: T }, createdAt: T2 }, // no usable createdBy anywhere
        c: { id: 's-2026-09-20', date: '2026-09-19', createdAt: T, createdBy: 'maya' }, // id mismatch
        d: { date: 'not-a-date', createdAt: T, createdBy: 'maya' },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(4)
    expect(r?.state.sessions).toEqual({})
  })

  it('drops invalid attendance entries individually and counts them', () => {
    const raw = {
      sessions: {
        's-2026-09-19': {
          id: 's-2026-09-19',
          date: '2026-09-19',
          type: 'game',
          physios: ['maya'],
          notes: { text: '', ...meta },
          playerAttendance: {
            good: { status: 'absent', ...meta },
            badStatus: { status: 'late', ...meta },
            badMeta: { status: 'present', updatedAt: T, updatedBy: 'ghost' },
            notObject: 'present',
          },
          createdAt: T,
          createdBy: 'maya',
        },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(3)
    expect(r?.state.sessions['s-2026-09-19']?.playerAttendance).toEqual({ good: { status: 'absent', ...meta } })
  })
})

describe('sanitizeState: injuries', () => {
  it('applies defaults for enum fields, description, reportedBy and deleted', () => {
    const raw = {
      injuries: {
        'i-1': { id: 'i-1', playerId: 'p-abc', date: '2026-09-19', bodyPart: 'Tail', side: 'middle', severity: 'Huge', status: 'Weird', sessionId: 7, ...meta },
      },
    }
    expect(sanitizeState(raw)?.state.injuries['i-1']).toEqual({
      id: 'i-1',
      playerId: 'p-abc',
      sessionId: null,
      date: '2026-09-19',
      bodyPart: 'Other',
      side: null,
      severity: 'Medium',
      status: 'Active',
      description: '',
      reportedBy: 'maya',
      deleted: false,
      ...meta,
    })
  })

  it('keeps valid values and drops injuries with a missing player or bad date', () => {
    const raw = {
      injuries: {
        'i-ok': { id: 'i-ok', playerId: 'p-abc', sessionId: 's-2026-09-19', date: '2026-09-19', bodyPart: 'Ankle', side: 'both', severity: 'High', status: 'Recovered', description: 'd', reportedBy: 'neta', deleted: true, ...meta },
        'i-noplayer': { id: 'i-noplayer', date: '2026-09-19', ...meta },
        'i-baddate': { id: 'i-baddate', playerId: 'p-abc', date: '19/09/2026', ...meta },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(2)
    expect(r?.state.injuries['i-ok']).toEqual({
      id: 'i-ok',
      playerId: 'p-abc',
      sessionId: 's-2026-09-19',
      date: '2026-09-19',
      bodyPart: 'Ankle',
      side: 'both',
      severity: 'High',
      status: 'Recovered',
      description: 'd',
      reportedBy: 'neta',
      deleted: true,
      ...meta,
    })
  })
})

// -------------------------------------------------------- review findings

describe('sanitizeState: review findings', () => {
  it('F1: defaults createdAt and createdBy field by field, then rebuilds an invalid notes Meta from them', () => {
    const raw = {
      sessions: {
        // notes.updatedBy is bad and createdAt is missing → createdAt from notes.updatedAt, createdBy from the record
        's-2026-09-19': { date: '2026-09-19', notes: { text: 'x', updatedAt: T, updatedBy: 'ghost' }, createdBy: 'maya' },
        // notes.updatedAt is bad and createdBy is missing → the mirror image
        's-2026-09-20': { date: '2026-09-20', notes: { text: 'y', updatedAt: '', updatedBy: 'neta' }, createdAt: T2 },
      },
    }
    const r = sanitizeState(raw)
    expect(r?.skipped).toBe(0)
    expect(r?.state.sessions['s-2026-09-19']).toEqual({
      id: 's-2026-09-19',
      date: '2026-09-19',
      type: 'workday',
      physios: [],
      notes: { text: 'x', updatedAt: T, updatedBy: 'maya' },
      playerAttendance: {},
      createdAt: T,
      createdBy: 'maya',
    })
    expect(r?.state.sessions['s-2026-09-20']).toEqual({
      id: 's-2026-09-20',
      date: '2026-09-20',
      type: 'workday',
      physios: [],
      notes: { text: 'y', updatedAt: T2, updatedBy: 'neta' },
      playerAttendance: {},
      createdAt: T2,
      createdBy: 'neta',
    })
  })

  it('F2: coerces non-boolean seeded/deleted flags to booleans instead of silently defaulting them', () => {
    const raw = {
      players: {
        a: { id: 'a', name: 'A', deleted: 1, seeded: 'yes', ...meta },
        b: { id: 'b', name: 'B', deleted: 'true', seeded: 0, ...meta },
      },
    }
    const p = sanitizeState(raw)?.state.players
    expect(p?.a?.deleted).toBe(true)
    expect(p?.a?.seeded).toBe(true)
    expect(p?.b?.deleted).toBe(true)
    expect(p?.b?.seeded).toBe(false)
  })

  it('F3: drops a player without a non-empty string id (the map key is not an id source)', () => {
    const raw = {
      players: {
        'from-key': { name: 'K', ...meta },
        'p-empty': { id: '', name: 'E', ...meta },
        'p-num': { id: 7, name: 'N', ...meta },
        'p-ok': { id: 'p-ok', name: 'O', ...meta },
      },
    }
    const r = sanitizeState(raw)
    expect(Object.keys(r?.state.players ?? {})).toEqual(['p-ok'])
    expect(r?.skipped).toBe(3)
  })

  it('F4: a "__proto__" key or id is dropped and counted, never written through the prototype setter', () => {
    // Built as text: JSON.parse creates an OWN "__proto__" property, an object literal would not.
    const rec = (id: string, name: string) => JSON.stringify({ id, name, ...meta })
    const att = JSON.stringify({ status: 'present', ...meta })
    const injury = JSON.stringify({ id: '__proto__', playerId: 'p-ok', date: '2026-09-19', ...meta })
    const text =
      `{"players":{"__proto__":${rec('__proto__', 'Evil')},"p-ok":${rec('p-ok', 'Ok')}},` +
      `"injuries":{"__proto__":${injury}},` +
      `"sessions":{"s-2026-09-19":{"id":"s-2026-09-19","date":"2026-09-19","createdAt":"${T}","createdBy":"maya",` +
      `"playerAttendance":{"__proto__":${att},"p-ok":${att}}}}}`
    const p = expectOk(parseBackupText(text))
    const { players, injuries, sessions } = p.envelope.data
    const attendance = sessions['s-2026-09-19']?.playerAttendance ?? {}
    for (const map of [players, injuries, attendance]) {
      expect(Object.getPrototypeOf(map)).toBe(Object.prototype)
      expect('updatedAt' in map).toBe(false)
      expect('id' in map).toBe(false)
    }
    expect(Object.keys(players)).toEqual(['p-ok'])
    expect(Object.keys(injuries)).toEqual([])
    expect(Object.keys(attendance)).toEqual(['p-ok'])
    expect(p.skipped).toBe(3)

    // The same when the id (not the key) is "__proto__".
    const r = sanitizeState({ players: { 'p-1': { id: '__proto__', name: 'Evil', ...meta } } })
    expect(r?.skipped).toBe(1)
    expect(Object.keys(r?.state.players ?? {})).toEqual([])
    expect(Object.getPrototypeOf(r?.state.players)).toBe(Object.prototype)
    expect('name' in (r?.state.players ?? {})).toBe(false)

    // Other Object.prototype names are ordinary ids: kept as own keys, not mistaken for collisions.
    const c = sanitizeState({ players: { constructor: { id: 'constructor', name: 'C', ...meta } } })
    expect(c?.skipped).toBe(0)
    expect(Object.keys(c?.state.players ?? {})).toEqual(['constructor'])
  })

  it('F5: two entries resolving to the same id keep the newest record and count the loser, whatever the order', () => {
    const newer = { id: 'p-1', name: 'NEWER', updatedAt: T2, updatedBy: 'maya' }
    const older = { id: 'p-1', name: 'OLDER', updatedAt: T, updatedBy: 'maya' }
    const a = sanitizeState({ players: { 'p-1': newer, 'wrong-key': older } })
    const b = sanitizeState({ players: { 'wrong-key': older, 'p-1': newer } })
    for (const r of [a, b]) {
      expect(Object.keys(r?.state.players ?? {})).toEqual(['p-1'])
      expect(r?.state.players['p-1']?.name).toBe('NEWER')
      expect(r?.skipped).toBe(1)
    }
    // JS enumerates integer-like keys first; the outcome must not depend on that.
    const c = sanitizeState({ players: { zzz: { ...newer, id: '5' }, '5': { ...older, id: '5' } } })
    expect(c?.state.players['5']?.name).toBe('NEWER')
    expect(c?.skipped).toBe(1)
    // Sessions carry no Meta: the first entry wins and the duplicate is still counted.
    const s = sanitizeState({
      sessions: {
        's-2026-09-19': { date: '2026-09-19', type: 'game', createdAt: T, createdBy: 'maya' },
        dup: { date: '2026-09-19', type: 'training', createdAt: T2, createdBy: 'neta' },
      },
    })
    expect(s?.state.sessions['s-2026-09-19']?.type).toBe('game')
    expect(s?.skipped).toBe(1)
  })
})
