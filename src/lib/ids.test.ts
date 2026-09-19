import { afterEach, describe, expect, it, vi } from 'vitest'
import { newInjuryId, newPlayerId, sessionIdFor, uuid, workDayIdFor } from './ids'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * Fake crypto.getRandomValues. `fill` = null fills with Math.random bytes,
 * otherwise every byte gets that value so the version/variant bits are testable.
 */
function fakeGetRandomValues(fill: number | null) {
  return <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = fill ?? Math.floor(Math.random() * 256)
      }
    }
    return array
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uuid', () => {
  it('produces a v4 UUID with the native crypto.randomUUID (Node has it)', () => {
    expect(typeof globalThis.crypto.randomUUID).toBe('function')
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(UUID_V4)
    expect(b).toMatch(UUID_V4)
    expect(a).not.toBe(b)
  })

  it('prefers crypto.randomUUID over getRandomValues when both exist', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'from-random-uuid',
      getRandomValues: fakeGetRandomValues(0),
    })
    expect(uuid()).toBe('from-random-uuid')
  })

  it('falls back to getRandomValues (iOS < 15.4 / plain-http LAN)', () => {
    vi.stubGlobal('crypto', { getRandomValues: fakeGetRandomValues(null) })
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(UUID_V4)
    expect(b).toMatch(UUID_V4)
    expect(a).toHaveLength(36)
    expect(a).not.toBe(b)
  })

  it('sets the version (4) and variant (8/9/a/b) bits in the getRandomValues path', () => {
    const cases: Array<[number, string]> = [
      [0x00, '00000000-0000-4000-8000-000000000000'],
      [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
      [0x7f, '7f7f7f7f-7f7f-4f7f-bf7f-7f7f7f7f7f7f'],
      [0x3a, '3a3a3a3a-3a3a-4a3a-ba3a-3a3a3a3a3a3a'],
    ]
    for (const [fill, expected] of cases) {
      vi.stubGlobal('crypto', { getRandomValues: fakeGetRandomValues(fill) })
      expect(uuid()).toBe(expected)
    }
  })

  it('still returns a non-empty unique string when crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined)
    expect(globalThis.crypto).toBeUndefined()
    const a = uuid()
    const b = uuid()
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
    expect(a).toMatch(/^[0-9a-z]+(-[0-9a-z]+){3}$/)
    expect(a).not.toBe(b)
  })

  it('still returns a non-empty unique string when crypto has neither function', () => {
    vi.stubGlobal('crypto', {})
    const a = uuid()
    const b = uuid()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })

  it('many calls never collide', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(uuid())
    expect(seen.size).toBe(1000)
  })
})

describe('prefixed random ids', () => {
  it('newInjuryId starts with "i-" followed by a UUID', () => {
    const id = newInjuryId()
    expect(id.startsWith('i-')).toBe(true)
    expect(id.slice(2)).toMatch(UUID_V4)
    expect(newInjuryId()).not.toBe(id)
  })

  it('newPlayerId starts with "p-" followed by a UUID', () => {
    const id = newPlayerId()
    expect(id.startsWith('p-')).toBe(true)
    expect(id.slice(2)).toMatch(UUID_V4)
    expect(newPlayerId()).not.toBe(id)
  })

  it('random player ids never look like a seeded player id', () => {
    // Seeded ids are 'p-<slug>'; a UUID has dashes at fixed positions and is
    // always 36 chars, so a generated id cannot clash with e.g. 'p-tom-curtis'.
    expect(newPlayerId()).not.toBe('p-tom-curtis')
    expect(newPlayerId()).toHaveLength(38)
  })
})

describe('deterministic ids', () => {
  it('sessionIdFor is one id per date, identical on every phone', () => {
    expect(sessionIdFor('2026-09-19')).toBe('s-2026-09-19')
    expect(sessionIdFor('2026-09-19')).toBe(sessionIdFor('2026-09-19'))
    expect(sessionIdFor('2026-09-20')).not.toBe(sessionIdFor('2026-09-19'))
  })

  it('workDayIdFor is one id per user per date', () => {
    expect(workDayIdFor('maya', '2026-09-19')).toBe('maya_2026-09-19')
    expect(workDayIdFor('shahar', '2026-09-19')).toBe('shahar_2026-09-19')
    expect(workDayIdFor('neta', '2026-01-01')).toBe('neta_2026-01-01')
    expect(workDayIdFor('maya', '2026-09-19')).toBe(workDayIdFor('maya', '2026-09-19'))
    expect(workDayIdFor('maya', '2026-09-19')).not.toBe(workDayIdFor('neta', '2026-09-19'))
    expect(workDayIdFor('maya', '2026-09-19')).not.toBe(workDayIdFor('maya', '2026-09-20'))
  })
})
