import type { Player } from './types'

/**
 * Stamp used for seeded records. It is far in the past so that ANY real edit
 * (which carries a current timestamp) wins over the seed when merging.
 */
export const SEED_EPOCH = '2020-01-01T00:00:00.000Z'

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Deterministic id for a seeded player, identical on every phone. */
export function seedPlayerId(name: string): string {
  return `p-${slugify(name)}`
}

const ROSTER: ReadonlyArray<readonly [number | null, string]> = [
  [1, 'Kusturlic Jarko'],
  [4, 'Truilia Stefan'],
  [5, 'Vujovic Filip'],
  [6, 'Varashuk Pavel'],
  [7, 'Tinok Aubameyang'],
  [16, 'Jabarin Ryan'],
  [20, 'Dahan Yiftach'],
  [21, 'Dusha Balint'],
  [22, 'Demidov Artyom'],
  [30, 'Shtrian Yonatan'],
  [31, 'Tkatch Daniel'],
  [33, 'Cohen Uri'],
  [null, 'Tom Curtis'],
  [null, 'Shalev Aharoni'],
]

export function buildSeedPlayers(): Record<string, Player> {
  const out: Record<string, Player> = {}
  for (const [number, name] of ROSTER) {
    const id = seedPlayerId(name)
    out[id] = {
      id,
      name,
      number,
      fitnessLevel: '',
      bodyStructure: '',
      bodyType: '',
      pastInjuries: '',
      rom: '',
      strengthening: '',
      seeded: true,
      deleted: false,
      updatedAt: SEED_EPOCH,
      updatedBy: 'shahar',
    }
  }
  return out
}

export const SEED_PLAYER_IDS: readonly string[] = ROSTER.map(([, name]) => seedPlayerId(name))
