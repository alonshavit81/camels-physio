import type { DateKey, UserId } from './types'

/**
 * UUID v4 with fallbacks: crypto.randomUUID is missing on iOS < 15.4 and in
 * non-secure contexts (plain http on a LAN), where getRandomValues still exists.
 */
export function uuid(): string {
  const c: Crypto | undefined = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const b = new Uint8Array(16)
    c.getRandomValues(b)
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  const rand = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${rand()}-${rand()}-${rand()}`
}

export const newInjuryId = (): string => `i-${uuid()}`
export const newPlayerId = (): string => `p-${uuid()}`

/** Deterministic: one session per date, identical on every phone. */
export const sessionIdFor = (date: DateKey): string => `s-${date}`

/** Deterministic: one work-day record per user per date. */
export const workDayIdFor = (userId: UserId, date: DateKey): string => `${userId}_${date}`
