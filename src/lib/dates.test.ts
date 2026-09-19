/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

// The club's phones live in Israel. Pin the test process to Asia/Jerusalem
// (UTC+2 in winter, UTC+3 in summer) so the local-vs-UTC assertions below are
// deterministic on any machine. Node resets its timezone cache whenever
// process.env.TZ is assigned; vi.hoisted() runs before the static imports.
vi.hoisted(() => {
  process.env.TZ = 'Asia/Jerusalem'
})

import {
  WEEKDAY_LABELS,
  WEEK_STARTS_ON,
  compareDateKeysDesc,
  currentMonthKey,
  dateKey,
  formatDateFull,
  formatDateShort,
  formatDayLong,
  formatMonthTitle,
  formatStamp,
  fromDateKey,
  fromMonthKey,
  isDateKey,
  isInMonth,
  isMonthKey,
  monthDays,
  monthGrid,
  monthKey,
  monthOf,
  nextStamp,
  nowStamp,
  shiftMonth,
  todayKey,
} from './dates'

const ISO_STAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const pad = (n: number) => String(n).padStart(2, '0')
/** Independent oracle for "the local calendar date of this Date". */
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

afterEach(() => {
  vi.useRealTimers()
})

describe('test environment', () => {
  it('runs in Asia/Jerusalem (UTC+3 in September, UTC+2 in January)', () => {
    expect(new Date(2026, 8, 19, 12).getTimezoneOffset()).toBe(-180)
    expect(new Date(2026, 0, 19, 12).getTimezoneOffset()).toBe(-120)
  })
})

describe('dateKey', () => {
  it('uses the LOCAL calendar date, zero padded', () => {
    expect(dateKey(new Date(2026, 8, 19, 23, 30))).toBe('2026-09-19')
    expect(dateKey(new Date(2026, 8, 19, 0, 0, 0, 0))).toBe('2026-09-19')
    expect(dateKey(new Date(2026, 8, 19, 23, 59, 59, 999))).toBe('2026-09-19')
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('differs from toISOString().slice(0, 10) shortly after local midnight', () => {
    // 01:30 in Jerusalem (UTC+3) is still 22:30 of the PREVIOUS day in UTC.
    const d = new Date(2026, 8, 19, 1, 30)
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(dateKey(d)).toBe('2026-09-19')
  })

  it('agrees with getFullYear/getMonth/getDate for every day of 2026 at several times of day', () => {
    for (let day = 0; day < 365; day++) {
      for (const [h, m] of [
        [0, 30],
        [12, 0],
        [23, 30],
      ] as const) {
        const d = new Date(2026, 0, 1 + day, h, m)
        expect(dateKey(d)).toBe(localKey(d))
      }
    }
  })

  it('is stable across the Israeli DST transitions', () => {
    // Spring forward: Fri 2026-03-27, 02:00 -> 03:00 (02:30 does not exist locally).
    expect(dateKey(new Date(2026, 2, 27, 2, 30))).toBe('2026-03-27')
    // Fall back: Sun 2026-10-25, 02:00 -> 01:00 (01:30 happens twice).
    expect(dateKey(new Date(2026, 9, 25, 1, 30))).toBe('2026-10-25')
  })
})

describe('fromDateKey', () => {
  it('returns local midnight of that calendar date', () => {
    const d = fromDateKey('2026-09-19')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(19)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('round-trips with dateKey for every day of 2026 (including DST days)', () => {
    for (let day = 0; day < 365; day++) {
      const key = localKey(new Date(2026, 0, 1 + day))
      expect(dateKey(fromDateKey(key))).toBe(key)
    }
  })

  it('does not depend on the current time (the parse reference date)', () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 31, 15, 45, 12) })
    const d = fromDateKey('2026-02-15')
    expect(localKey(d)).toBe('2026-02-15')
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })
})

describe('isDateKey', () => {
  it('accepts well-formed, existing calendar dates', () => {
    expect(isDateKey('2026-02-28')).toBe(true)
    expect(isDateKey('2024-02-29')).toBe(true) // leap year
    expect(isDateKey('2026-09-19')).toBe(true)
    expect(isDateKey('2026-12-31')).toBe(true)
    expect(isDateKey('2026-01-01')).toBe(true)
  })

  it('rejects dates that do not exist', () => {
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-02-29')).toBe(false) // 2026 is not a leap year
    expect(isDateKey('2026-04-31')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-00-10')).toBe(false)
    expect(isDateKey('2026-09-00')).toBe(false)
  })

  it('rejects wrong shapes and non-strings', () => {
    expect(isDateKey('2026-9-1')).toBe(false)
    expect(isDateKey('2026-09-19T00:00')).toBe(false)
    expect(isDateKey(' 2026-09-19')).toBe(false)
    expect(isDateKey('2026-09-19 ')).toBe(false)
    expect(isDateKey('19-09-2026')).toBe(false)
    expect(isDateKey('2026/09/19')).toBe(false)
    expect(isDateKey('')).toBe(false)
    expect(isDateKey(20260919)).toBe(false)
    expect(isDateKey(null)).toBe(false)
    expect(isDateKey(undefined)).toBe(false)
    expect(isDateKey(new Date(2026, 8, 19))).toBe(false)
    expect(isDateKey({ key: '2026-09-19' })).toBe(false)
  })
})

describe('isMonthKey', () => {
  it('accepts yyyy-MM with a real month', () => {
    expect(isMonthKey('2026-09')).toBe(true)
    expect(isMonthKey('2026-01')).toBe(true)
    expect(isMonthKey('2026-12')).toBe(true)
  })

  it('rejects impossible months, wrong shapes and non-strings', () => {
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-00')).toBe(false)
    expect(isMonthKey('2026-9')).toBe(false)
    expect(isMonthKey('2026-09-19')).toBe(false)
    expect(isMonthKey('2026')).toBe(false)
    expect(isMonthKey('')).toBe(false)
    expect(isMonthKey(202609)).toBe(false)
    expect(isMonthKey(null)).toBe(false)
    expect(isMonthKey(undefined)).toBe(false)
  })
})

describe('monthKey / fromMonthKey', () => {
  it('monthKey formats the local month', () => {
    expect(monthKey(new Date(2026, 8, 19))).toBe('2026-09')
    expect(monthKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01')
    // 00:30 on Jan 1 (UTC+2) is still Dec 31 in UTC: the key must stay local.
    expect(new Date(2026, 0, 1, 0, 30).toISOString().slice(0, 7)).toBe('2025-12')
  })

  it('fromMonthKey returns local midnight on the 1st', () => {
    const d = fromMonthKey('2026-09')
    expect(localKey(d)).toBe('2026-09-01')
    expect(d.getHours()).toBe(0)
  })

  it('fromMonthKey is not affected by today being the 31st', () => {
    // A naive setMonth() on Jan 31 would overflow Feb into March.
    vi.useFakeTimers({ now: new Date(2026, 0, 31, 12) })
    expect(localKey(fromMonthKey('2026-02'))).toBe('2026-02-01')
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
  })
})

describe('monthOf / isInMonth', () => {
  it('monthOf is the yyyy-MM prefix', () => {
    expect(monthOf('2026-09-19')).toBe('2026-09')
    expect(monthOf('2026-01-01')).toBe('2026-01')
  })

  it('isInMonth compares the prefix', () => {
    expect(isInMonth('2026-09-19', '2026-09')).toBe(true)
    expect(isInMonth('2026-09-01', '2026-09')).toBe(true)
    expect(isInMonth('2026-10-01', '2026-09')).toBe(false)
    expect(isInMonth('2025-09-19', '2026-09')).toBe(false)
  })
})

describe('todayKey / currentMonthKey / nowStamp', () => {
  it('todayKey and currentMonthKey use local time', () => {
    // 01:30 local on Sep 19 is 22:30Z on Sep 18: the local date must win.
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 1, 30) })
    expect(new Date().toISOString()).toBe('2026-09-18T22:30:00.000Z')
    expect(todayKey()).toBe('2026-09-19')
    expect(currentMonthKey()).toBe('2026-09')
  })

  it('nowStamp is an ISO UTC timestamp', () => {
    expect(nowStamp()).toMatch(ISO_STAMP_RE)
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 1, 30) })
    expect(nowStamp()).toBe('2026-09-18T22:30:00.000Z')
  })

  it('nowStamp orders lexicographically by time', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 1, 30) })
    const earlier = nowStamp()
    vi.setSystemTime(new Date(2026, 8, 19, 1, 30, 0, 1))
    const later = nowStamp()
    expect(later > earlier).toBe(true)
    // Year rollover still sorts correctly as strings.
    expect('2027-01-01T00:00:00.000Z' > '2026-12-31T23:59:59.999Z').toBe(true)
  })
})

describe('shiftMonth', () => {
  it('crosses year boundaries in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('handles zero and multi-year deltas', () => {
    expect(shiftMonth('2026-09', 0)).toBe('2026-09')
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-09', -1)).toBe('2026-08')
    expect(shiftMonth('2026-09', 12)).toBe('2027-09')
    expect(shiftMonth('2026-09', -12)).toBe('2025-09')
    expect(shiftMonth('2026-03', -15)).toBe('2024-12')
    expect(shiftMonth('2026-03', 22)).toBe('2028-01')
  })

  it('is invertible', () => {
    for (let delta = -30; delta <= 30; delta++) {
      expect(shiftMonth(shiftMonth('2026-09', delta), -delta)).toBe('2026-09')
    }
  })
})

describe('monthDays', () => {
  it('has the right number of days, in order, all inside the month', () => {
    const cases: Array<[string, number]> = [
      ['2026-02', 28],
      ['2024-02', 29],
      ['2026-09', 30],
      ['2026-12', 31],
      ['2026-01', 31],
    ]
    for (const [month, expected] of cases) {
      const days = monthDays(month)
      expect(days).toHaveLength(expected)
      expect(days[0]).toBe(`${month}-01`)
      expect(days[days.length - 1]).toBe(`${month}-${pad(expected)}`)
      for (let i = 0; i < days.length; i++) {
        const key = days[i] as string
        expect(isDateKey(key)).toBe(true)
        expect(isInMonth(key, month)).toBe(true)
        expect(key).toBe(`${month}-${pad(i + 1)}`)
      }
    }
  })

  it('does not depend on the current date', () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 31, 23, 59) })
    expect(monthDays('2026-02')).toHaveLength(28)
  })
})

describe('monthGrid', () => {
  /** Every key in the grid must be exactly one day after the previous one. */
  function expectContiguous(grid: string[]): void {
    for (let i = 1; i < grid.length; i++) {
      const prev = fromDateKey(grid[i - 1] as string)
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1)
      expect(grid[i]).toBe(dateKey(next))
    }
  }

  it('September 2026 is 5 whole weeks from Sun 30 Aug to Sat 3 Oct', () => {
    const grid = monthGrid('2026-09')
    expect(grid).toHaveLength(35)
    expect(grid[0]).toBe('2026-08-30')
    expect(grid[grid.length - 1]).toBe('2026-10-03')
    expect(fromDateKey(grid[0] as string).getDay()).toBe(0) // Sunday
    expectContiguous(grid)
    for (const key of monthDays('2026-09')) expect(grid).toContain(key)
    expect(grid.filter((k) => isInMonth(k, '2026-09'))).toEqual(monthDays('2026-09'))
    expect(grid.filter((k) => !isInMonth(k, '2026-09'))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
  })

  it('February 2026 needs exactly 4 weeks (starts Sunday, 28 days)', () => {
    const grid = monthGrid('2026-02')
    expect(grid).toHaveLength(28)
    expect(grid).toEqual(monthDays('2026-02'))
  })

  it('months spilling over 6 weeks give 42 keys', () => {
    expect(monthGrid('2027-05')).toHaveLength(42) // Sat 1 May .. Mon 31 May
    expect(monthGrid('2026-08')).toHaveLength(42) // Sat 1 Aug .. Mon 31 Aug
    expect(monthGrid('2026-08')[0]).toBe('2026-07-26')
    expect(monthGrid('2026-08')[41]).toBe('2026-09-05')
  })

  it('always starts on Sunday, ends on Saturday, has whole weeks and contains the month', () => {
    let month = '2024-01'
    for (let i = 0; i < 36; i++) {
      const grid = monthGrid(month)
      expect([28, 35, 42]).toContain(grid.length)
      expect(grid.length % 7).toBe(0)
      expect(fromDateKey(grid[0] as string).getDay()).toBe(WEEK_STARTS_ON)
      expect(fromDateKey(grid[grid.length - 1] as string).getDay()).toBe(6)
      for (let w = 0; w < grid.length; w += 7) {
        expect(fromDateKey(grid[w] as string).getDay()).toBe(0)
      }
      expectContiguous(grid)
      const inMonth = grid.filter((k) => isInMonth(k, month))
      expect(inMonth).toEqual(monthDays(month))
      for (const key of grid) expect(isDateKey(key)).toBe(true)
      month = shiftMonth(month, 1)
    }
  })
})

describe('week constants', () => {
  it('the week starts on Sunday with 7 labels', () => {
    expect(WEEK_STARTS_ON).toBe(0)
    expect(WEEKDAY_LABELS).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    // The label at index getDay() matches the grid's first column.
    expect(WEEKDAY_LABELS[fromDateKey(monthGrid('2026-09')[0] as string).getDay()]).toBe('Sun')
  })
})

describe('format helpers', () => {
  it('formatMonthTitle', () => {
    expect(formatMonthTitle('2026-09')).toBe('September 2026')
    expect(formatMonthTitle('2027-01')).toBe('January 2027')
  })

  it('formatDayLong (no zero padding)', () => {
    expect(formatDayLong('2026-09-19')).toBe('Sat 19 Sep')
    expect(formatDayLong('2026-01-05')).toBe('Mon 5 Jan')
  })

  it('formatDateFull', () => {
    expect(formatDateFull('2026-09-19')).toBe('Saturday 19 September 2026')
    expect(formatDateFull('2026-01-05')).toBe('Monday 5 January 2026')
  })

  it('formatDateShort', () => {
    expect(formatDateShort('2026-09-19')).toBe('19 Sep 2026')
    expect(formatDateShort('2026-01-05')).toBe('5 Jan 2026')
  })

  it('formatStamp renders an ISO stamp in local time (24h clock)', () => {
    expect(formatStamp('2026-09-19T18:30:00.000Z')).toBe('19 Sep 2026, 21:30') // IDT, UTC+3
    expect(formatStamp('2026-01-05T06:05:00.000Z')).toBe('5 Jan 2026, 08:05') // IST, UTC+2
    // Crossing midnight: 22:30Z on the 18th is 01:30 on the 19th locally.
    expect(formatStamp('2026-09-18T22:30:00.000Z')).toBe('19 Sep 2026, 01:30')
    expect(formatStamp('2026-09-19T18:30:00+00:00')).toBe('19 Sep 2026, 21:30')
  })

  it('formatStamp falls back to the raw string for garbage', () => {
    expect(formatStamp('not-a-date')).toBe('not-a-date')
    expect(formatStamp('')).toBe('')
  })
})

describe('compareDateKeysDesc', () => {
  it('sorts newest first', () => {
    const keys = ['2026-09-01', '2025-12-31', '2026-10-01', '2026-09-19']
    expect([...keys].sort(compareDateKeysDesc)).toEqual([
      '2026-10-01',
      '2026-09-19',
      '2026-09-01',
      '2025-12-31',
    ])
  })

  it('returns the sign expected by Array.prototype.sort', () => {
    expect(compareDateKeysDesc('2026-09-19', '2026-09-20')).toBe(1)
    expect(compareDateKeysDesc('2026-09-20', '2026-09-19')).toBe(-1)
    expect(compareDateKeysDesc('2026-09-19', '2026-09-19')).toBe(0)
  })
})

describe('nextStamp', () => {
  const NOW = '2026-09-19T18:30:00.000Z'

  it('is now when there is no previous stamp or the previous one is in the past', () => {
    vi.useFakeTimers({ now: new Date(NOW) })
    expect(nextStamp()).toBe(NOW)
    expect(nextStamp('2026-09-19T18:29:59.999Z')).toBe(NOW)
    expect(nextStamp('2020-01-01T00:00:00.000Z')).toBe(NOW)
  })

  it('is 1 ms after a previous stamp that is at or ahead of the clock (wrong clock on another phone, edited file)', () => {
    vi.useFakeTimers({ now: new Date(NOW) })
    expect(nextStamp(NOW)).toBe('2026-09-19T18:30:00.001Z')
    expect(nextStamp('9999-01-01T00:00:00.000Z')).toBe('9999-01-01T00:00:00.001Z')
  })

  it('always outranks the previous stamp in the lexicographic order the merge uses', () => {
    vi.useFakeTimers({ now: new Date(NOW) })
    for (const prev of ['2020-01-01T00:00:00.000Z', NOW, '2030-12-31T23:59:59.999Z', '9999-01-01T00:00:00.000Z']) {
      expect(nextStamp(prev) > prev).toBe(true)
    }
  })

  it('falls back to now for an unparseable previous stamp or one at the largest Date', () => {
    vi.useFakeTimers({ now: new Date(NOW) })
    expect(nextStamp('zzz')).toBe(NOW)
    // Parses to the max Date (8.64e15 ms); +1 ms is out of range and must not throw.
    expect(nextStamp('Sep 13 275760 00:00:00 GMT')).toBe(NOW)
  })
})
