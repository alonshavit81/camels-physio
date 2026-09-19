import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { USER_IDS, type DateKey, type Injury, type MonthKey, type Player, type Session, type UserId } from '../lib/types'
import { compareDateKeysDesc, formatMonthTitle, isInMonth, monthOf } from '../lib/dates'
import { physiosForDate } from '../lib/apply'
import { workDayIdFor } from '../lib/ids'
import { getOwn, useAppStore, type AppState } from './useAppStore'

// ---------------------------------------------------------------- players

/** Live (non-deleted) players sorted by jersey number, players without a number last, then by name. */
export function playersSorted(players: Record<string, Player>): Player[] {
  return Object.values(players)
    .filter((p) => !p.deleted)
    .sort((a, b) => {
      if (a.number === null && b.number !== null) return 1
      if (a.number !== null && b.number === null) return -1
      if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number
      return a.name.localeCompare(b.name)
    })
}

/** Lookup by id that ignores Object.prototype members (a route param such as "constructor" is not a player). */
export function playerById(players: Record<string, Player>, id: string | undefined): Player | undefined {
  return id ? getOwn(players, id) : undefined
}

export function playerLabel(player: Player | undefined): string {
  if (!player) return 'Unknown player'
  return player.number === null ? player.name : `#${player.number} ${player.name}`
}

// --------------------------------------------------------------- injuries

/** Newest date first; ties broken by id so toggling a status never reorders a list. */
function byDateDesc(a: Injury, b: Injury): number {
  return compareDateKeysDesc(a.date, b.date) || a.id.localeCompare(b.id)
}

/** Injuries whose player was deleted are hidden from counts and statistics (the records are kept for merging). */
function injuriesOfLivePlayers(injuries: Record<string, Injury>, players: Record<string, Player>): Injury[] {
  return liveInjuries(injuries).filter((i) => !players[i.playerId]?.deleted)
}

export function liveInjuries(injuries: Record<string, Injury>): Injury[] {
  return Object.values(injuries).filter((i) => !i.deleted)
}

export function injuriesForPlayer(injuries: Record<string, Injury>, playerId: string): Injury[] {
  return liveInjuries(injuries)
    .filter((i) => i.playerId === playerId)
    .sort(byDateDesc)
}

export function injuriesForSession(injuries: Record<string, Injury>, sessionId: string): Injury[] {
  return liveInjuries(injuries)
    .filter((i) => i.sessionId === sessionId)
    .sort(byDateDesc)
}

export function activeInjuryCountByPlayer(injuries: Record<string, Injury>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of liveInjuries(injuries)) {
    if (i.status === 'Active') out[i.playerId] = (out[i.playerId] ?? 0) + 1
  }
  return out
}

export interface InjuryStats {
  total: number
  active: number
  topPlayers: Array<{ playerId: string; name: string; number: number | null; count: number; active: number }>
  byBodyPart: Array<{ bodyPart: string; count: number }>
}

export function injuryStats(injuries: Record<string, Injury>, players: Record<string, Player>, limit = 5): InjuryStats {
  const live = injuriesOfLivePlayers(injuries, players)
  const perPlayer = new Map<string, { count: number; active: number }>()
  const perPart = new Map<string, number>()
  let active = 0
  for (const i of live) {
    const p = perPlayer.get(i.playerId) ?? { count: 0, active: 0 }
    p.count += 1
    if (i.status === 'Active') {
      p.active += 1
      active += 1
    }
    perPlayer.set(i.playerId, p)
    perPart.set(i.bodyPart, (perPart.get(i.bodyPart) ?? 0) + 1)
  }
  const topPlayers = [...perPlayer.entries()]
    .map(([playerId, c]) => {
      const player = players[playerId]
      return { playerId, name: player?.name ?? 'Unknown player', number: player?.number ?? null, ...c }
    })
    .sort((a, b) => b.count - a.count || b.active - a.active || a.name.localeCompare(b.name))
    .slice(0, limit)
  const byBodyPart = [...perPart.entries()]
    .map(([bodyPart, count]) => ({ bodyPart, count }))
    .sort((a, b) => b.count - a.count || a.bodyPart.localeCompare(b.bodyPart))
  return { total: live.length, active, topPlayers, byBodyPart }
}

// -------------------------------------------------------------- calendar

export function workDaysPerUser(workDays: AppState['workDays'], month: MonthKey): Record<UserId, number> {
  const out = { shahar: 0, maya: 0, neta: 0 } as Record<UserId, number>
  for (const w of Object.values(workDays)) {
    if (w.worked && isInMonth(w.date, month)) out[w.userId] += 1
  }
  return out
}

export function usersWorkedOn(workDays: AppState['workDays'], date: DateKey): UserId[] {
  return physiosForDate(workDays, date)
}

export function userWorkedOn(workDays: AppState['workDays'], userId: UserId, date: DateKey): boolean {
  return workDays[workDayIdFor(userId, date)]?.worked ?? false
}

// --------------------------------------------------------------- sessions

export function sessionsSorted(sessions: Record<string, Session>): Session[] {
  return Object.values(sessions).sort((a, b) => compareDateKeysDesc(a.date, b.date))
}

export interface SessionMonthGroup {
  month: MonthKey
  title: string
  sessions: Session[]
}

/** Sessions grouped by month, newest month (and newest date within it) first. */
export function sessionsByMonth(sessions: Record<string, Session>): SessionMonthGroup[] {
  const groups = new Map<MonthKey, Session[]>()
  for (const s of sessionsSorted(sessions)) {
    const m = monthOf(s.date)
    const list = groups.get(m)
    if (list) list.push(s)
    else groups.set(m, [s])
  }
  return [...groups.entries()].map(([month, list]) => ({ month, title: formatMonthTitle(month), sessions: list }))
}

/** Lookup by id that ignores Object.prototype members (see playerById). */
export function sessionById(sessions: Record<string, Session>, id: string | undefined): Session | undefined {
  return id ? getOwn(sessions, id) : undefined
}

export function sessionPresentCount(session: Session): number {
  return Object.values(session.playerAttendance).filter((a) => a.status === 'present').length
}

export function sessionInjuryCount(injuries: Record<string, Injury>, sessionId: string): number {
  return injuriesForSession(injuries, sessionId).length
}

/** Order user ids in the canonical USER_IDS order. */
export function sortUserIds(ids: Iterable<UserId>): UserId[] {
  const set = new Set(ids)
  return USER_IDS.filter((id) => set.has(id))
}

// ------------------------------------------------------------------ hooks

export const useCurrentUserId = (): UserId | null => useAppStore((s) => s.currentUserId)

export const usePlayersSorted = (): Player[] => useAppStore(useShallow((s) => playersSorted(s.players)))

export const usePlayer = (id: string | undefined): Player | undefined => useAppStore((s) => playerById(s.players, id))

export const useInjuriesForPlayer = (playerId: string | undefined): Injury[] =>
  useAppStore(useShallow((s) => (playerId ? injuriesForPlayer(s.injuries, playerId) : [])))

export const useInjuriesForSession = (sessionId: string | undefined): Injury[] =>
  useAppStore(useShallow((s) => (sessionId ? injuriesForSession(s.injuries, sessionId) : [])))

export const useActiveInjuryCounts = (): Record<string, number> =>
  useAppStore(useShallow((s) => activeInjuryCountByPlayer(s.injuries)))

export const useSession = (id: string | undefined): Session | undefined => useAppStore((s) => sessionById(s.sessions, id))

export const useSessionsByMonth = (): SessionMonthGroup[] => {
  const sessions = useAppStore((s) => s.sessions)
  return useMemo(() => sessionsByMonth(sessions), [sessions])
}

export const useInjuryStats = (limit = 5): InjuryStats => {
  const injuries = useAppStore((s) => s.injuries)
  const players = useAppStore((s) => s.players)
  return useMemo(() => injuryStats(injuries, players, limit), [injuries, players, limit])
}

export const useWorkDaysPerUser = (month: MonthKey): Record<UserId, number> =>
  useAppStore(useShallow((s) => workDaysPerUser(s.workDays, month)))
