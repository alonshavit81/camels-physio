import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { DateKey, MonthKey, Stamp } from './types'

/** The club is Israeli: the week (and the calendar grid) starts on Sunday. */
export const WEEK_STARTS_ON = 0 as const
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY_RE = /^\d{4}-\d{2}$/

/** Local calendar date as 'yyyy-MM-dd'. NEVER use toISOString().slice(0, 10): it shifts to UTC. */
export function dateKey(d: Date): DateKey {
  return format(d, 'yyyy-MM-dd')
}

export function fromDateKey(key: DateKey): Date {
  return parse(key, 'yyyy-MM-dd', new Date())
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false
  const d = fromDateKey(value)
  return isValid(d) && dateKey(d) === value
}

export function isMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string' || !MONTH_KEY_RE.test(value)) return false
  return isValid(fromMonthKey(value))
}

export function monthKey(d: Date): MonthKey {
  return format(d, 'yyyy-MM')
}

export function fromMonthKey(month: MonthKey): Date {
  return parse(month, 'yyyy-MM', new Date())
}

/** 'yyyy-MM' prefix of a date key. */
export function monthOf(key: DateKey): MonthKey {
  return key.slice(0, 7)
}

export function isInMonth(key: DateKey, month: MonthKey): boolean {
  return key.startsWith(month)
}

export function todayKey(): DateKey {
  return dateKey(new Date())
}

export function currentMonthKey(): MonthKey {
  return monthKey(new Date())
}

/** ISO UTC timestamp used for `updatedAt`; compared lexicographically. */
export function nowStamp(): Stamp {
  return new Date().toISOString()
}

/**
 * Stamp for an edit of an existing record: now, or 1 ms after `previous` when
 * the device clock is behind it (a phone with a wrong clock, a hand-edited
 * file), so the edit always outranks the copy it was made on in a merge.
 * An unparseable `previous` falls back to now.
 */
export function nextStamp(previous?: Stamp): Stamp {
  const now = nowStamp()
  if (previous === undefined || previous < now) return now
  const t = Date.parse(previous)
  if (!Number.isFinite(t)) return now
  try {
    return new Date(t + 1).toISOString()
  } catch {
    return now // beyond the largest representable Date
  }
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(fromMonthKey(month), delta))
}

/** Every date of the month, in order. */
export function monthDays(month: MonthKey): DateKey[] {
  const start = fromMonthKey(month)
  return eachDayOfInterval({ start: startOfMonth(start), end: endOfMonth(start) }).map(dateKey)
}

/**
 * Full weeks (Sunday..Saturday) covering the month: 28, 35 or 42 keys.
 * Leading/trailing keys belong to the neighbouring months (check with isInMonth).
 */
export function monthGrid(month: MonthKey): DateKey[] {
  const start = fromMonthKey(month)
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(endOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
  }).map(dateKey)
}

/** 'September 2026' */
export function formatMonthTitle(month: MonthKey): string {
  return format(fromMonthKey(month), 'MMMM yyyy')
}

/** 'Thu 19 Sep' */
export function formatDayLong(key: DateKey): string {
  return format(fromDateKey(key), 'EEE d MMM')
}

/** 'Thursday 19 September 2026' */
export function formatDateFull(key: DateKey): string {
  return format(fromDateKey(key), 'EEEE d MMMM yyyy')
}

/** '19 Sep 2026' */
export function formatDateShort(key: DateKey): string {
  return format(fromDateKey(key), 'd MMM yyyy')
}

/** '19 Sep 2026, 21:30' (local time) for an ISO stamp; falls back to the raw string. */
export function formatStamp(stamp: Stamp): string {
  const d = new Date(stamp)
  return isValid(d) ? format(d, 'd MMM yyyy, HH:mm') : stamp
}

/** Sort helper: newest date first. */
export function compareDateKeysDesc(a: DateKey, b: DateKey): number {
  return a < b ? 1 : a > b ? -1 : 0
}

/**
 * Human-friendly age of a stamp for the sync cues: 'just now', '12 min ago',
 * '3 h ago', 'yesterday', '4 days ago', then the plain date ('19 Sep 2026').
 * Clock skew between phones can make a stamp sit in the future: that reads as 'just now'.
 */
export function formatRelative(stamp: Stamp, now: Date = new Date()): string {
  const t = Date.parse(stamp)
  if (!Number.isFinite(t)) return stamp
  const then = new Date(t)
  const diffMin = Math.floor((now.getTime() - t) / 60_000)
  if (diffMin < 1) return 'just now'
  const days = differenceInCalendarDays(now, then)
  if (days <= 0) {
    if (diffMin < 60) return `${diffMin} min ago`
    return `${Math.floor(diffMin / 60)} h ago`
  }
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return format(then, 'd MMM yyyy')
}
