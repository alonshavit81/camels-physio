import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  SCHEMA_VERSION,
  type ApplyResult,
  type AttendanceStatus,
  type BackupEnvelope,
  type ConflictPolicy,
  type DateKey,
  type Injury,
  type InjuryFields,
  type MergeSummary,
  type Meta,
  type MonthKey,
  type NewInjuryInput,
  type PersistedState,
  type Player,
  type PlayerFields,
  type TeamEventKind,
  type UserId,
} from '../lib/types'
import { ensureSeedPlayers, mergeState } from '../lib/merge'
import { applyMonthlyAttendance as applyMonthlyAttendancePure } from '../lib/apply'
import { buildExport, migratePersisted, sanitizeState } from '../lib/backup'
import { nextStamp, nowStamp } from '../lib/dates'
import { newInjuryId, newPlayerId, workDayIdFor } from '../lib/ids'
import { SEED_PLAYER_IDS, buildSeedPlayers } from '../lib/seedPlayers'
import { canEditTeamEvents, isUserId } from '../lib/users'
import { isStorageHealthy, onStorageHealthChange, safeStorage } from '../lib/storage'

export const STORAGE_KEY = 'camels-physio'
/** Where an unreadable localStorage value is set aside before the app starts fresh (kept for manual recovery). */
export const CORRUPT_STORAGE_KEY = `${STORAGE_KEY}.corrupt`

/** Persisted per device (remembers who owns the phone) but never exported. */
export interface DeviceState {
  currentUserId: UserId | null
}

/** Runtime-only flags, never persisted. */
export interface RuntimeState {
  hydrated: boolean
  storageHealthy: boolean
  /** True when the data saved on this device could not be read and the app started from seed data. */
  storageReset: boolean
}

export type AppState = PersistedState & DeviceState & RuntimeState

export interface AppActions {
  setCurrentUser: (id: UserId | null) => void
  /** Cycle none → training → game → none. Returns false when the current user may not edit team events. */
  cycleTeamEvent: (date: DateKey) => boolean
  /** Toggle the current user's own work day. */
  toggleWorkDay: (date: DateKey) => void
  /** Generate/refresh one session per calendar-backed date of the month. */
  applyMonthlyAttendance: (month: MonthKey) => ApplyResult
  updatePlayer: (id: string, patch: Partial<PlayerFields>) => void
  addPlayer: (input: { name: string; number: number | null }) => string | null
  /** Tombstones a manually added player and its live injuries. Seeded players cannot be deleted (returns false). */
  deletePlayer: (id: string) => boolean
  setPlayerSessionStatus: (sessionId: string, playerId: string, status: AttendanceStatus) => void
  updateSessionNotes: (sessionId: string, text: string) => void
  addInjury: (input: NewInjuryInput) => string | null
  updateInjury: (id: string, patch: Partial<InjuryFields>) => void
  deleteInjury: (id: string) => void
  /** Merge an imported backup into this device's data. */
  importData: (envelope: BackupEnvelope, policy?: ConflictPolicy) => MergeSummary
  exportSnapshot: () => BackupEnvelope
  ensureSeed: () => void
  setHydrated: (value: boolean) => void
  setStorageHealthy: (value: boolean) => void
}

export type AppStore = AppState & AppActions

/** The five collections + schemaVersion, i.e. exactly what is merged/exported. */
export function persistedSlice(s: PersistedState): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    players: s.players,
    teamEvents: s.teamEvents,
    workDays: s.workDays,
    sessions: s.sessions,
    injuries: s.injuries,
  }
}

/** Own-key lookup: a route param such as "constructor" must never resolve to an Object.prototype member. */
export function getOwn<T>(map: Record<string, T>, id: string): T | undefined {
  return Object.hasOwn(map, id) ? map[id] : undefined
}

/** Fresh merge metadata. Pass the record being edited so the new stamp always outranks it (see nextStamp). */
function stamp(user: UserId, existing?: Meta): Meta {
  return { updatedAt: nextStamp(existing?.updatedAt), updatedBy: user }
}

function nextKind(kind: TeamEventKind): TeamEventKind {
  return kind === 'none' ? 'training' : kind === 'training' ? 'game' : 'none'
}

/**
 * Roster invariant, enforced at the store boundary (hydration and import): a
 * seeded player is never a tombstone and never loses its `seeded` flag,
 * whatever a merged file said. Nothing in the app can write either, so such a
 * record is a hand-edited or corrupt copy; a tombstone would otherwise spread
 * to every phone and could never be undone. Other fields and the stamp are
 * kept. Returns the same reference when nothing needed repair.
 */
function repairSeedPlayers(players: Record<string, Player>): Record<string, Player> {
  let out: Record<string, Player> | null = null
  for (const id of SEED_PLAYER_IDS) {
    const p = getOwn(players, id)
    if (p && (p.deleted || !p.seeded)) {
      out ??= { ...players }
      out[id] = { ...p, seeded: true, deleted: false }
    }
  }
  return out ?? players
}

type PersistedShape = PersistedState & DeviceState

/** Fresh device data: the seed roster and nothing else. */
function initialData(): PersistedShape {
  return {
    schemaVersion: SCHEMA_VERSION,
    players: buildSeedPlayers(),
    teamEvents: {},
    workDays: {},
    sessions: {},
    injuries: {},
    currentUserId: null,
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hydrated: false,
      storageHealthy: isStorageHealthy(),
      storageReset: false,

      setCurrentUser: (id) => set({ currentUserId: id }),

      cycleTeamEvent: (date) => {
        const user = get().currentUserId
        if (!user || !canEditTeamEvents(user)) return false
        const existing = get().teamEvents[date]
        const kind = nextKind(existing?.kind ?? 'none')
        set((s) => ({ teamEvents: { ...s.teamEvents, [date]: { id: date, date, kind, ...stamp(user, existing) } } }))
        return true
      },

      toggleWorkDay: (date) => {
        const user = get().currentUserId
        if (!user) return
        const id = workDayIdFor(user, date)
        const existing = get().workDays[id]
        const worked = !(existing?.worked ?? false)
        set((s) => ({ workDays: { ...s.workDays, [id]: { id, userId: user, date, worked, ...stamp(user, existing) } } }))
      },

      applyMonthlyAttendance: (month) => {
        const user = get().currentUserId
        if (!user) return { created: 0, updated: 0, unchanged: 0, pruned: 0 }
        const { state, result } = applyMonthlyAttendancePure(persistedSlice(get()), month, nowStamp(), user)
        set({ sessions: state.sessions })
        return result
      },

      updatePlayer: (id, patch) => {
        const user = get().currentUserId
        const existing = getOwn(get().players, id)
        if (!user || !existing) return
        set((s) => ({ players: { ...s.players, [id]: { ...existing, ...patch, ...stamp(user, existing) } } }))
      },

      addPlayer: ({ name, number }) => {
        const user = get().currentUserId
        const trimmed = name.trim()
        if (!user || !trimmed) return null
        const id = newPlayerId()
        const player: Player = {
          id,
          name: trimmed,
          number,
          fitnessLevel: '',
          bodyStructure: '',
          bodyType: '',
          pastInjuries: '',
          rom: '',
          strengthening: '',
          seeded: false,
          deleted: false,
          ...stamp(user),
        }
        set((s) => ({ players: { ...s.players, [id]: player } }))
        return id
      },

      deletePlayer: (id) => {
        const user = get().currentUserId
        const existing = getOwn(get().players, id)
        if (!user || !existing || existing.seeded) return false
        set((s) => {
          // The player's live injuries go with it, each with a fresh stamp so the
          // tombstones win on merge; otherwise session badges, statistics and the
          // monthly prune would keep counting injuries of a player nobody can see.
          const injuries = { ...s.injuries }
          for (const [key, i] of Object.entries(s.injuries)) {
            if (i.playerId === id && !i.deleted) injuries[key] = { ...i, deleted: true, ...stamp(user, i) }
          }
          return { players: { ...s.players, [id]: { ...existing, deleted: true, ...stamp(user, existing) } }, injuries }
        })
        return true
      },

      setPlayerSessionStatus: (sessionId, playerId, status) => {
        const user = get().currentUserId
        const session = getOwn(get().sessions, sessionId)
        if (!user || !session) return
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sessionId]: {
              ...session,
              playerAttendance: {
                ...session.playerAttendance,
                [playerId]: { status, ...stamp(user, session.playerAttendance[playerId]) },
              },
            },
          },
        }))
      },

      updateSessionNotes: (sessionId, text) => {
        const user = get().currentUserId
        const session = getOwn(get().sessions, sessionId)
        if (!user || !session || session.notes.text === text) return
        set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...session, notes: { text, ...stamp(user, session.notes) } } } }))
      },

      addInjury: (input) => {
        const user = get().currentUserId
        if (!user || !getOwn(get().players, input.playerId)) return null
        const id = newInjuryId()
        const injury: Injury = { ...input, id, reportedBy: user, deleted: false, ...stamp(user) }
        set((s) => {
          const next: Partial<AppState> = { injuries: { ...s.injuries, [id]: injury } }
          // Reporting an injury inside a session marks the player as injured there, unless already marked.
          const session = input.sessionId ? getOwn(s.sessions, input.sessionId) : undefined
          const mark = session?.playerAttendance[input.playerId]
          if (session && (mark?.status ?? 'unset') === 'unset') {
            next.sessions = {
              ...s.sessions,
              [session.id]: {
                ...session,
                playerAttendance: { ...session.playerAttendance, [input.playerId]: { status: 'injured', ...stamp(user, mark) } },
              },
            }
          }
          return next
        })
        return id
      },

      updateInjury: (id, patch) => {
        const user = get().currentUserId
        const existing = getOwn(get().injuries, id)
        if (!user || !existing || existing.deleted) return
        set((s) => ({ injuries: { ...s.injuries, [id]: { ...existing, ...patch, ...stamp(user, existing) } } }))
      },

      deleteInjury: (id) => {
        const user = get().currentUserId
        const existing = getOwn(get().injuries, id)
        if (!user || !existing || existing.deleted) return
        set((s) => ({ injuries: { ...s.injuries, [id]: { ...existing, deleted: true, ...stamp(user, existing) } } }))
      },

      importData: (envelope, policy = 'newest') => {
        const { merged, summary } = mergeState(persistedSlice(get()), envelope.data, policy)
        set({
          players: repairSeedPlayers(merged.players),
          teamEvents: merged.teamEvents,
          workDays: merged.workDays,
          sessions: merged.sessions,
          injuries: merged.injuries,
        })
        return summary
      },

      exportSnapshot: () => buildExport(persistedSlice(get()), get().currentUserId, nowStamp()),

      ensureSeed: () => {
        const slice = persistedSlice(get())
        const players = repairSeedPlayers(ensureSeedPlayers(slice).players)
        if (players !== slice.players) set({ players })
      },

      setHydrated: (hydrated) => set({ hydrated }),
      setStorageHealthy: (storageHealthy) => set({ storageHealthy }),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): PersistedShape => ({ ...persistedSlice(s), currentUserId: s.currentUserId }),
      migrate: (persisted, version) => migratePersisted(persisted, version) as PersistedShape,
      // The saved blob gets the same record-level validation as an imported file:
      // a hand-edited, downgraded or half-written value can neither crash
      // hydration (e.g. `players: null`) nor load junk records verbatim, and a
      // stale currentUserId brings back the user gate instead of a ghost user.
      merge: (persisted, current) => {
        const raw = persisted as Partial<PersistedShape> | undefined
        const clean = sanitizeState(raw)
        if (clean && clean.skipped > 0) console.warn(`[camels-physio] ${clean.skipped} invalid saved record(s) were dropped`)
        return {
          ...current,
          ...(clean ? clean.state : {}),
          currentUserId: isUserId(raw?.currentUserId) ? raw.currentUserId : null,
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.ensureSeed()
        state?.setHydrated(true)
      },
    },
  ),
)

onStorageHealthChange((healthy) => useAppStore.getState().setStorageHealthy(healthy))

// localStorage hydration runs synchronously inside create(), so if persist has not
// hydrated by now it threw (unparseable JSON, empty string, ...). Set the raw value
// aside for recovery, start from seed data and tell the user, instead of leaving
// the app on the loading splash forever.
if (!useAppStore.persist.hasHydrated()) {
  const raw = safeStorage.getItem(STORAGE_KEY)
  if (typeof raw === 'string') safeStorage.setItem(CORRUPT_STORAGE_KEY, raw)
  console.error(`[camels-physio] saved data could not be read; starting with seed data (copy kept under "${CORRUPT_STORAGE_KEY}")`)
  useAppStore.setState({ ...initialData(), hydrated: true, storageHealthy: isStorageHealthy(), storageReset: true })
}

// degrade() can already have fired during that synchronous hydration (blocked or
// full localStorage), before the listener above existed: resync once.
if (!isStorageHealthy()) useAppStore.getState().setStorageHealthy(false)
