import type { Player } from '../../lib/types'

export const MAX_PLAYER_NUMBER = 999

export const PLAYER_NUMBER_ERROR = `Enter a whole number from 0 to ${MAX_PLAYER_NUMBER}, or leave it blank.`

export type PlayerNumberParse = { ok: true; value: number | null } | { ok: false; error: string }

/**
 * Parse the free-text jersey number field. Blank means "no number".
 * Accepts an optional leading '#'. Only whole numbers 0–999 are valid.
 */
export function parsePlayerNumber(raw: string): PlayerNumberParse {
  const text = raw.trim().replace(/^#/, '')
  if (text === '') return { ok: true, value: null }
  if (!/^\d{1,3}$/.test(text)) return { ok: false, error: PLAYER_NUMBER_ERROR }
  return { ok: true, value: Number(text) }
}

/** '#7' or 'No #' for badges. */
export function playerNumberBadgeLabel(number: number | null): string {
  return number === null ? 'No #' : `#${number}`
}

/** '#7' or 'No number' for headings. */
export function playerNumberLabel(number: number | null): string {
  return number === null ? 'No number' : `#${number}`
}

/** Case-insensitive name match, or an exact jersey-number match ('7' or '#7'). */
export function playerMatchesQuery(player: Player, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (player.name.toLowerCase().includes(q)) return true
  const numeric = q.replace(/^#/, '')
  return /^\d{1,3}$/.test(numeric) && player.number === Number(numeric)
}
