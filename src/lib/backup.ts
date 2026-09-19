/**
 * Backup files: building/serialising exports and parsing/validating imports.
 *
 * The physios exchange JSON files over WhatsApp, so an imported file may be
 * anything: our own envelope, a raw localStorage dump (Zustand persist
 * wrapper), a hand-edited file, or garbage. Parsing is therefore defensive:
 * the shape is detected, the schema version checked, and every record is
 * re-validated with hand-written guards. Invalid records are dropped and
 * counted (`skipped`), never fatal. Pure functions only, no I/O.
 */
import { format } from 'date-fns'
import {
  ATTENDANCE_STATUSES,
  BACKUP_APP_ID,
  BODY_PARTS,
  BODY_TYPES,
  INJURY_STATUSES,
  SCHEMA_VERSION,
  SESSION_TYPES,
  SEVERITIES,
  SIDES,
  TEAM_EVENT_KINDS,
  USER_IDS,
} from './types'
import type {
  BackupEnvelope,
  Injury,
  Meta,
  ParseResult,
  PersistedState,
  Player,
  PlayerAttendance,
  Session,
  Stamp,
  TeamEvent,
  UserId,
  WorkDay,
} from './types'
import { isDateKey } from './dates'
import { sessionIdFor, workDayIdFor } from './ids'
import { pickNewer } from './merge'
import { SEED_PLAYER_IDS, slugify } from './seedPlayers'
import { isUserId } from './users'

// ------------------------------------------------------------ error texts

/** Shown when the file cannot even be parsed as JSON. */
export const ERR_NOT_JSON = 'This file is not valid JSON.'
/** Shown when the JSON has none of the shapes we recognise. */
export const ERR_NOT_BACKUP = 'This file is not a Camels Physio backup.'

/** Message for a file written by an app with a newer data schema than ours. */
export function newerVersionError(version: number): string {
  return `This backup was made by a newer app version (schema ${version}). Please update the app, then import again.`
}

// ---------------------------------------------------------------- export

/**
 * The five collections that go into a backup. A wider object (for example
 * the live store, which also carries `currentUserId` / `hydrated`) is accepted;
 * only these keys are copied into the export.
 */
export type ExportableState = Pick<PersistedState, 'players' | 'teamEvents' | 'workDays' | 'sessions' | 'injuries'>

/** Wrap the persisted collections in a backup envelope. Device-only keys are stripped. */
export function buildExport(state: ExportableState, exportedBy: UserId | null, now: Stamp): BackupEnvelope {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    exportedBy,
    data: {
      schemaVersion: SCHEMA_VERSION,
      players: state.players,
      teamEvents: state.teamEvents,
      workDays: state.workDays,
      sessions: state.sessions,
      injuries: state.injuries,
    },
  }
}

/** Pretty-printed JSON text of an envelope. No BOM; Hebrew stays as-is (JSON is UTF-8). */
export function serializeExport(env: BackupEnvelope): string {
  return JSON.stringify(env, null, 2)
}

/**
 * `camels-physio_2026-09-19_2130_maya.json`. The user name is slugified to
 * ASCII so the name is safe on every file system / messaging app; a name that
 * slugifies to nothing (empty, only Hebrew letters, ...) becomes 'unknown'.
 */
export function backupFilename(now: Date, userName: string): string {
  const slug = slugify(userName) || 'unknown'
  return `camels-physio_${format(now, 'yyyy-MM-dd')}_${format(now, 'HHmm')}_${slug}.json`
}

// ------------------------------------------------------------- migration

/**
 * One step per released schema version: MIGRATIONS[n] upgrades the raw data
 * from version n to n + 1. Add an entry here whenever SCHEMA_VERSION is bumped,
 * e.g. `1: (raw) => upgradeV1ToV2(raw)`.
 */
const MIGRATIONS: Readonly<Record<number, (raw: unknown) => unknown>> = {}

/**
 * Upgrade raw persisted data from `fromVersion` to the current SCHEMA_VERSION
 * by applying the migration steps in order. The current version is an identity.
 * An older version with no known step is returned unchanged and left to
 * sanitizeState, which keeps whatever still validates.
 */
export function migratePersisted(raw: unknown, fromVersion: number): unknown {
  let data = raw
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) break
    data = step(data)
  }
  return data
}

// ---------------------------------------------------------- small guards

type Dict = Record<string, unknown>

/** A JSON object that is not an array (and not null). */
function isPlainObject(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

/** `v` when it is one of `list`, otherwise `fallback`. */
function oneOfOr<T extends string, F>(list: readonly T[], v: unknown, fallback: F): T | F {
  return oneOf(list, v) ? v : fallback
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

/** Free-text fields: any string is kept, anything else becomes ''. */
function strField(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Flags: a missing (or null) value takes the default; anything present is coerced (truthy → true). */
function boolField(v: unknown, fallback: boolean): boolean {
  return v === undefined || v === null ? fallback : Boolean(v)
}

function asUserId(v: unknown): UserId | null {
  return isUserId(v) ? v : null
}

/** The merge metadata every record needs; null when it is unusable. */
function readMeta(rec: Dict): Meta | null {
  const updatedAt = nonEmptyString(rec.updatedAt)
  const updatedBy = asUserId(rec.updatedBy)
  if (updatedAt === null || updatedBy === null) return null
  return { updatedAt, updatedBy }
}

/**
 * Injury ids: the record's own id, else the map key it sat under. (Players are
 * stricter: the spec requires the record itself to carry a non-empty id.)
 */
function resolveId(rec: Dict, key: string): string | null {
  return nonEmptyString(rec.id) ?? nonEmptyString(key)
}

/**
 * "__proto__" can never be a real id or player key: assigning it on a plain
 * object hits the Object.prototype setter instead of creating a key, so the
 * record would vanish and poison the map. Such entries are refused (and counted).
 */
function isSafeKey(key: string): boolean {
  return key !== '' && key !== '__proto__'
}

/**
 * Deterministic ids (team events, work days, sessions) are a pure function of
 * other fields: absent → derived; present → must equal the derived value.
 */
function deterministicId(given: unknown, expected: string): string | null {
  if (given === undefined || given === null || given === '') return expected
  return given === expected ? expected : null
}

const JERSEY_RE = /^\d{1,3}$/

/** Jersey number: integer 0..999, numeric strings coerced, anything else → null. */
function toJerseyNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 999 ? v : null
  if (typeof v === 'string' && JERSEY_RE.test(v.trim())) return Number(v.trim())
  return null
}

/** Finite number or numeric string, else null. */
function versionOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

// --------------------------------------------------------- record guards

/** Mutable counter shared by the guards of one sanitizeState call (local, never an input). */
interface Tally {
  skipped: number
}

function sanitizePlayer(raw: unknown): Player | null {
  if (!isPlainObject(raw)) return null
  const meta = readMeta(raw)
  const id = nonEmptyString(raw.id)
  if (meta === null || id === null) return null
  return {
    id,
    name: strField(raw.name),
    number: toJerseyNumber(raw.number),
    fitnessLevel: strField(raw.fitnessLevel),
    bodyStructure: strField(raw.bodyStructure),
    bodyType: oneOfOr(BODY_TYPES, raw.bodyType, ''),
    pastInjuries: strField(raw.pastInjuries),
    rom: strField(raw.rom),
    strengthening: strField(raw.strengthening),
    seeded: boolField(raw.seeded, SEED_PLAYER_IDS.includes(id)),
    deleted: boolField(raw.deleted, false),
    ...meta,
  }
}

function sanitizeTeamEvent(raw: unknown): TeamEvent | null {
  if (!isPlainObject(raw)) return null
  const meta = readMeta(raw)
  const date = raw.date
  if (meta === null || !isDateKey(date)) return null
  const id = deterministicId(raw.id, date)
  const kind = oneOfOr(TEAM_EVENT_KINDS, raw.kind, null)
  if (id === null || kind === null) return null
  return { id, date, kind, ...meta }
}

function sanitizeWorkDay(raw: unknown): WorkDay | null {
  if (!isPlainObject(raw)) return null
  const meta = readMeta(raw)
  const userId = asUserId(raw.userId)
  const date = raw.date
  if (meta === null || userId === null || !isDateKey(date)) return null
  const id = deterministicId(raw.id, workDayIdFor(userId, date))
  if (id === null) return null
  return { id, userId, date, worked: boolField(raw.worked, true), ...meta }
}

/** Valid user ids only, de-duplicated, in USER_IDS order (so merges compare equal). */
function sanitizePhysios(v: unknown): UserId[] {
  if (!Array.isArray(v)) return []
  return USER_IDS.filter((u) => v.includes(u))
}

function sanitizeAttendance(raw: unknown): PlayerAttendance | null {
  if (!isPlainObject(raw)) return null
  const meta = readMeta(raw)
  const status = oneOfOr(ATTENDANCE_STATUSES, raw.status, null)
  if (meta === null || status === null) return null
  return { status, ...meta }
}

function sanitizeSession(raw: unknown, _key: string, tally: Tally): Session | null {
  if (!isPlainObject(raw)) return null
  const date = raw.date
  if (!isDateKey(date)) return null
  const id = deterministicId(raw.id, sessionIdFor(date))
  if (id === null) return null

  // A session has no top-level Meta. createdAt/createdBy default FIELD BY FIELD
  // to notes.updatedAt / notes.updatedBy, and the session is dropped only when a
  // field is usable from neither side. A notes Meta that is not valid as a pair
  // is then rebuilt from the resolved createdAt/createdBy.
  const notesRaw = isPlainObject(raw.notes) ? raw.notes : {}
  const createdAt = nonEmptyString(raw.createdAt) ?? nonEmptyString(notesRaw.updatedAt)
  const createdBy = asUserId(raw.createdBy) ?? asUserId(notesRaw.updatedBy)
  if (createdAt === null || createdBy === null) return null
  const notes = { text: strField(notesRaw.text), ...(readMeta(notesRaw) ?? { updatedAt: createdAt, updatedBy: createdBy }) }

  // Attendance entries validate one by one; a bad entry costs only itself.
  const playerAttendance: Record<string, PlayerAttendance> = {}
  if (isPlainObject(raw.playerAttendance)) {
    for (const [playerId, entry] of Object.entries(raw.playerAttendance)) {
      const clean = isSafeKey(playerId) ? sanitizeAttendance(entry) : null
      if (clean) playerAttendance[playerId] = clean
      else tally.skipped++
    }
  }

  return {
    id,
    date,
    type: oneOfOr(SESSION_TYPES, raw.type, 'workday'),
    physios: sanitizePhysios(raw.physios),
    notes,
    playerAttendance,
    createdAt,
    createdBy,
  }
}

function sanitizeInjury(raw: unknown, key: string): Injury | null {
  if (!isPlainObject(raw)) return null
  const meta = readMeta(raw)
  const id = resolveId(raw, key)
  const playerId = nonEmptyString(raw.playerId)
  const date = raw.date
  if (meta === null || id === null || playerId === null || !isDateKey(date)) return null
  return {
    id,
    playerId,
    sessionId: stringOrNull(raw.sessionId),
    date,
    bodyPart: oneOfOr(BODY_PARTS, raw.bodyPart, 'Other'),
    side: oneOfOr(SIDES, raw.side, null),
    severity: oneOfOr(SEVERITIES, raw.severity, 'Medium'),
    status: oneOfOr(INJURY_STATUSES, raw.status, 'Active'),
    description: strField(raw.description),
    reportedBy: asUserId(raw.reportedBy) ?? meta.updatedBy,
    deleted: boolField(raw.deleted, false),
    ...meta,
  }
}

// ------------------------------------------------------------- sanitize

const COLLECTIONS = ['players', 'teamEvents', 'workDays', 'sessions', 'injuries'] as const

/** True when at least one of the five collections is present as an object. */
function hasCollections(obj: Dict): boolean {
  return COLLECTIONS.some((name) => isPlainObject(obj[name]))
}

/**
 * Validate every entry of one collection. Records are re-keyed by their own id,
 * so a map key that disagrees with the record is ignored. When two entries
 * resolve to the same id, `prefer` picks the survivor (newest Meta for the flat
 * collections, the first one seen for sessions) and the loser is counted as
 * skipped, so nothing is ever discarded silently. An id of "__proto__" is
 * refused (see isSafeKey). A collection that is missing or not an object is
 * treated as empty.
 */
function sanitizeMap<T extends { id: string }>(
  map: unknown,
  guard: (rec: unknown, key: string, tally: Tally) => T | null,
  tally: Tally,
  prefer: (kept: T, other: T) => T = (kept) => kept,
): Record<string, T> {
  const out: Record<string, T> = {}
  if (!isPlainObject(map)) return out
  for (const [key, rec] of Object.entries(map)) {
    const clean = guard(rec, key, tally)
    if (clean === null || !isSafeKey(clean.id)) {
      tally.skipped++
      continue
    }
    // Object.hasOwn: an id such as "constructor" must not look like a collision with Object.prototype.
    const kept = Object.hasOwn(out, clean.id) ? out[clean.id] : undefined
    if (kept === undefined) {
      out[clean.id] = clean
    } else {
      out[clean.id] = prefer(kept, clean)
      tally.skipped++
    }
  }
  return out
}

/**
 * Turn untrusted JSON into a valid PersistedState, or null when it is not one
 * (not an object, or none of the five collections present as an object).
 * Missing collections become empty maps; invalid records (and invalid
 * attendance entries inside sessions) are dropped and counted in `skipped`,
 * as is the losing copy when two entries share one id.
 * Unknown keys are not carried over. The input is never mutated.
 */
export function sanitizeState(raw: unknown): { state: PersistedState; skipped: number } | null {
  if (!isPlainObject(raw) || !hasCollections(raw)) return null
  const tally: Tally = { skipped: 0 }
  const state: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    players: sanitizeMap(raw.players, sanitizePlayer, tally, pickNewer),
    teamEvents: sanitizeMap(raw.teamEvents, sanitizeTeamEvent, tally, pickNewer),
    workDays: sanitizeMap(raw.workDays, sanitizeWorkDay, tally, pickNewer),
    sessions: sanitizeMap(raw.sessions, sanitizeSession, tally),
    injuries: sanitizeMap(raw.injuries, sanitizeInjury, tally, pickNewer),
  }
  return { state, skipped: tally.skipped }
}

// ---------------------------------------------------------------- parse

interface DetectedShape {
  /** The object that should hold the collections (after unwrapping). */
  payload: unknown
  version: number
  exportedAt: Stamp
  exportedBy: UserId | null
}

/**
 * Recognise the three accepted shapes:
 *  (a) our envelope            { app: 'camels-physio', schemaVersion, exportedAt, exportedBy, data }
 *  (b) Zustand persist wrapper { state: {...}, version? }   (raw localStorage pasted by a user)
 *  (c) raw PersistedState      { players, teamEvents, ... }
 */
function detectShape(json: unknown): DetectedShape | null {
  if (!isPlainObject(json)) return null

  const data = json.data
  if (json.app === BACKUP_APP_ID && isPlainObject(data)) {
    return {
      payload: data,
      version: versionOf(json.schemaVersion) ?? versionOf(data.schemaVersion) ?? 1,
      exportedAt: strField(json.exportedAt),
      exportedBy: asUserId(json.exportedBy),
    }
  }

  const wrapped = json.state
  if (isPlainObject(wrapped)) {
    return {
      payload: wrapped,
      version: versionOf(json.version) ?? versionOf(wrapped.schemaVersion) ?? 1,
      exportedAt: '',
      exportedBy: null,
    }
  }

  if (hasCollections(json)) {
    return { payload: json, version: versionOf(json.schemaVersion) ?? 1, exportedAt: '', exportedBy: null }
  }

  return null
}

/**
 * Parse the text of an imported file into a clean envelope.
 * Steps: strip BOM → JSON.parse → detect shape → version check (newer than
 * us is rejected, older is migrated) → sanitize record by record.
 * The returned envelope always has our app id and the current schema version.
 */
export function parseBackupText(text: string): ParseResult {
  // Some editors / transfers prepend a byte-order mark, which JSON.parse rejects.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return { ok: false, error: ERR_NOT_JSON }
  }

  const shape = detectShape(json)
  if (shape === null) return { ok: false, error: ERR_NOT_BACKUP }

  if (shape.version > SCHEMA_VERSION) return { ok: false, error: newerVersionError(shape.version) }
  const payload = shape.version < SCHEMA_VERSION ? migratePersisted(shape.payload, shape.version) : shape.payload

  const clean = sanitizeState(payload)
  if (clean === null) return { ok: false, error: ERR_NOT_BACKUP }

  return {
    ok: true,
    envelope: {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: shape.exportedAt,
      exportedBy: shape.exportedBy,
      data: clean.state,
    },
    skipped: clean.skipped,
  }
}
