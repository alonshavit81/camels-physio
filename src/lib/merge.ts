/**
 * Merge logic for Camels Physio.
 *
 * There is no server: every phone owns a full copy of the data and the physios
 * exchange JSON backups over WhatsApp. Importing a backup MERGES it into the
 * local state so that all phones converge:
 *
 *  - Flat collections (players, teamEvents, workDays, injuries) merge per id
 *    with "newest `updatedAt` wins". Deletions are tombstones whose stamp was
 *    bumped, so they beat a stale live copy without any special casing.
 *  - Sessions have no session-level stamp. `physios` is a set union minus
 *    anyone whose work day is a tombstone (`worked: false`) in the merged
 *    calendar, `notes` is last-writer-wins on its own stamp,
 *    `playerAttendance` is last-writer-wins per player key, `createdAt` is
 *    the earliest creation, and `type` is recomputed from the merged
 *    calendar afterwards (`reconcileSessionTypes`).
 *  - Seeded players are restored if a phone lost them (`ensureSeedPlayers`).
 *
 * Everything here is pure: inputs are never mutated. Outputs are fresh
 * top-level objects that may share unchanged records with `local`.
 */
import { workDayIdFor } from './ids'
import { buildSeedPlayers } from './seedPlayers'
import {
  SCHEMA_VERSION,
  USER_IDS,
  type ConflictPolicy,
  type Counts,
  type DateKey,
  type MergeSummary,
  type Meta,
  type PersistedState,
  type Session,
  type SessionType,
  type TeamEventKind,
  type UserId,
} from './types'

// ------------------------------------------------------------ summaries

/** A zeroed `{ added, updated, unchanged }` counter. */
export function emptyCounts(): Counts {
  return { added: 0, updated: 0, unchanged: 0 }
}

/** A zeroed merge summary (one counter per collection + skippedInvalid). */
export function emptyMergeSummary(): MergeSummary {
  return {
    players: emptyCounts(),
    teamEvents: emptyCounts(),
    workDays: emptyCounts(),
    sessions: emptyCounts(),
    attendanceEntries: emptyCounts(),
    injuries: emptyCounts(),
    skippedInvalid: 0,
  }
}

/** Adds `delta` into `target` in place. `target` is always a counter we created ourselves. */
function addCounts(target: Counts, delta: Counts): void {
  target.added += delta.added
  target.updated += delta.updated
  target.unchanged += delta.unchanged
}

// ------------------------------------------------------------ conflicts

/**
 * Deterministic "newest edit wins" for any record carrying `Meta`.
 *
 * 1. the greater `updatedAt` (ISO UTC string, compared lexicographically) wins;
 * 2. on a stamp tie the greater `updatedBy` string wins, so the choice does not
 *    depend on which phone runs the merge (commutative);
 * 3. on a full tie `a` is returned (callers pass the local record as `a`).
 *
 * The store uses the same helper, so every phone applies one rule.
 */
export function pickNewer<T extends Meta>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if (a.updatedBy !== b.updatedBy) return a.updatedBy > b.updatedBy ? a : b
  return a
}

/**
 * Generic per-id merge of two `Record<id, T>` maps.
 *
 * - id only in incoming → added (shallow copy, the flat records have no nesting)
 * - id in both, policy 'newest' → `pickNewer`; incoming wins → updated,
 *   local wins (including any tie) → unchanged
 * - id in both, policy 'local' → never replaced → unchanged
 *
 * Ids that exist only locally are kept and not counted. The result is built
 * through a Map so that an id such as "__proto__" coming from a file cannot
 * hit the prototype setter of a plain object.
 */
function mergeMap<T extends Meta>(
  local: Record<string, T>,
  incoming: Record<string, T>,
  policy: ConflictPolicy,
): { map: Record<string, T>; counts: Counts } {
  const out = new Map<string, T>(Object.entries(local))
  const counts = emptyCounts()
  for (const [id, theirs] of Object.entries(incoming)) {
    const mine = out.get(id)
    if (mine === undefined) {
      out.set(id, { ...theirs })
      counts.added++
    } else if (policy === 'local' || pickNewer(mine, theirs) === mine) {
      counts.unchanged++
    } else {
      out.set(id, { ...theirs })
      counts.updated++
    }
  }
  return { map: Object.fromEntries(out), counts }
}

// ------------------------------------------------------------- sessions

/** Deep copy of a session so the merged state never aliases the incoming file. */
function cloneSession(s: Session): Session {
  return {
    ...s,
    physios: [...s.physios],
    notes: { ...s.notes },
    playerAttendance: Object.fromEntries(
      Object.entries(s.playerAttendance).map(([playerId, entry]) => [playerId, { ...entry }]),
    ),
  }
}

/** Set union of two physio lists, always emitted in `USER_IDS` order. */
function unionPhysios(a: readonly UserId[], b: readonly UserId[]): UserId[] {
  const present = new Set<UserId>([...a, ...b])
  return USER_IDS.filter((id) => present.has(id))
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}

/**
 * Drops from `physios` every user whose work day on `date` is a tombstone
 * (`worked: false`) in `workDays`. The calendar is the source of truth: when a
 * physio un-marked a day on one phone, the set union with a stale session list
 * from another phone must not resurrect them. Users without any work-day
 * record are kept, so the union alone decides for them. Always a new array.
 */
function activePhysios(physios: readonly UserId[], workDays: PersistedState['workDays'], date: DateKey): UserId[] {
  return physios.filter((userId) => workDays[workDayIdFor(userId, date)]?.worked !== false)
}

/**
 * Field-by-field merge of one session present on both sides.
 * `workDays` is the already merged calendar (it decides which physios stay);
 * `attendance` accumulates the per-player-key counts for the summary.
 * Returns the local session itself when nothing changed.
 */
function mergeSession(
  mine: Session,
  theirs: Session,
  policy: ConflictPolicy,
  workDays: PersistedState['workDays'],
  attendance: Counts,
): { session: Session; changed: boolean } {
  // physios: union (a union only ever grows, so it is fine under policy 'local'
  // too), minus anyone the merged calendar says did not work that day
  const physios = activePhysios(unionPhysios(mine.physios, theirs.physios), workDays, mine.date)
  const physiosChanged = !sameList(physios, mine.physios)

  // notes: last-writer-wins on the notes' own stamp
  const notes = policy === 'local' ? mine.notes : pickNewer(mine.notes, theirs.notes)
  const notesChanged = notes !== mine.notes

  // attendance: independent LWW per player key
  const att = mergeMap(mine.playerAttendance, theirs.playerAttendance, policy)
  addCounts(attendance, att.counts)
  const attendanceChanged = att.counts.added > 0 || att.counts.updated > 0

  // createdAt: the earliest creation wins and createdBy follows it. On an exact
  // createdAt tie the greater createdBy wins (the same tie-break as pickNewer),
  // so the outcome does not depend on which phone runs the merge.
  const theirsCreatedFirst =
    theirs.createdAt !== mine.createdAt ? theirs.createdAt < mine.createdAt : theirs.createdBy > mine.createdBy

  // type: deliberately NOT merged here, reconcileSessionTypes recomputes it
  const changed = physiosChanged || notesChanged || attendanceChanged || theirsCreatedFirst
  if (!changed) return { session: mine, changed: false }

  return {
    session: {
      ...mine,
      physios: physiosChanged ? physios : mine.physios,
      notes: notesChanged ? { ...notes } : mine.notes,
      playerAttendance: att.map,
      createdAt: theirsCreatedFirst ? theirs.createdAt : mine.createdAt,
      createdBy: theirsCreatedFirst ? theirs.createdBy : mine.createdBy,
    },
    changed: true,
  }
}

/**
 * Per-id merge of the sessions map; see `mergeSession` for the field rules.
 * `workDays` is the already merged calendar.
 */
function mergeSessions(
  local: Record<string, Session>,
  incoming: Record<string, Session>,
  policy: ConflictPolicy,
  workDays: PersistedState['workDays'],
): { map: Record<string, Session>; counts: Counts; attendance: Counts } {
  const out = new Map<string, Session>(Object.entries(local))
  const counts = emptyCounts()
  const attendance = emptyCounts()
  for (const [id, theirs] of Object.entries(incoming)) {
    const mine = out.get(id)
    if (mine === undefined) {
      out.set(id, cloneSession(theirs))
      counts.added++
      attendance.added += Object.keys(theirs.playerAttendance).length
      continue
    }
    const result = mergeSession(mine, theirs, policy, workDays, attendance)
    if (result.changed) {
      out.set(id, result.session)
      counts.updated++
    } else {
      counts.unchanged++
    }
  }
  return { map: Object.fromEntries(out), counts, attendance }
}

// ---------------------------------------------------------- reconciling

/** Session type implied by the calendar: game > training > plain work day. */
function sessionTypeFor(kind: TeamEventKind | undefined): SessionType {
  if (kind === 'game') return 'game'
  if (kind === 'training') return 'training'
  return 'workday'
}

/**
 * Recomputes every session's `type` from `state.teamEvents` (the calendar,
 * itself merged last-writer-wins, is the source of truth). A date with no
 * event, or a cleared ('none') event, yields 'workday'.
 * Returns the same object reference when no session needed a change.
 */
export function reconcileSessionTypes(state: PersistedState): PersistedState {
  let changed = false
  const sessions = new Map<string, Session>()
  for (const [id, session] of Object.entries(state.sessions)) {
    const type = sessionTypeFor(state.teamEvents[session.date]?.kind)
    if (type === session.type) {
      sessions.set(id, session)
    } else {
      sessions.set(id, { ...session, type })
      changed = true
    }
  }
  return changed ? { ...state, sessions: Object.fromEntries(sessions) } : state
}

/**
 * Drops from every session the physios whose work day is a tombstone in
 * `state.workDays` (see `activePhysios`). Sessions merged field by field are
 * already clean; this pass covers the sessions that exist on one side only,
 * whose calendar may still have changed through the other side.
 * Returns the same object reference when no session needed a change.
 */
function reconcileSessionPhysios(state: PersistedState): PersistedState {
  let changed = false
  const sessions = new Map<string, Session>()
  for (const [id, session] of Object.entries(state.sessions)) {
    const physios = activePhysios(session.physios, state.workDays, session.date)
    if (sameList(physios, session.physios)) {
      sessions.set(id, session)
    } else {
      sessions.set(id, { ...session, physios })
      changed = true
    }
  }
  return changed ? { ...state, sessions: Object.fromEntries(sessions) } : state
}

/**
 * Adds every seeded player that is missing from `state.players`.
 * Existing seeded players are never touched, even when edited or deleted.
 * Returns the same object reference when nothing is missing.
 */
export function ensureSeedPlayers(state: PersistedState): PersistedState {
  const missing = Object.entries(buildSeedPlayers()).filter(([id]) => !Object.hasOwn(state.players, id))
  if (missing.length === 0) return state
  return { ...state, players: { ...state.players, ...Object.fromEntries(missing) } }
}

// ---------------------------------------------------------------- merge

/**
 * Merges `incoming` (a parsed, validated backup) into `local`.
 *
 * 1. players / teamEvents / workDays / injuries: per-id newest-wins (`mergeMap`).
 * 2. sessions: per-field merge (`mergeSession`, against the merged work days);
 *    sessions only in the file are deep-copied and their attendance entries
 *    count as added.
 * 3. `reconcileSessionTypes` recomputes session types from the merged calendar
 *    and `reconcileSessionPhysios` drops physios whose merged work day is a
 *    tombstone (only sessions present on one side can still need this).
 * 4. `ensureSeedPlayers` restores any seeded player the merged state lacks.
 *
 * With policy 'local' records already present locally are never replaced;
 * new ids are still added and unions still apply.
 * `summary.skippedInvalid` is always 0 here: validation lives in backup.ts.
 * Neither input is mutated.
 */
export function mergeState(
  local: PersistedState,
  incoming: PersistedState,
  policy: ConflictPolicy = 'newest',
): { merged: PersistedState; summary: MergeSummary } {
  const players = mergeMap(local.players, incoming.players, policy)
  const teamEvents = mergeMap(local.teamEvents, incoming.teamEvents, policy)
  const workDays = mergeMap(local.workDays, incoming.workDays, policy)
  const injuries = mergeMap(local.injuries, incoming.injuries, policy)
  const sessions = mergeSessions(local.sessions, incoming.sessions, policy, workDays.map)

  const collections: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    players: players.map,
    teamEvents: teamEvents.map,
    workDays: workDays.map,
    sessions: sessions.map,
    injuries: injuries.map,
  }
  const merged = ensureSeedPlayers(reconcileSessionPhysios(reconcileSessionTypes(collections)))

  const summary: MergeSummary = {
    players: players.counts,
    teamEvents: teamEvents.counts,
    workDays: workDays.counts,
    sessions: sessions.counts,
    attendanceEntries: sessions.attendance,
    injuries: injuries.counts,
    skippedInvalid: 0,
  }
  return { merged, summary }
}
