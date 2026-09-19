import { describe, expect, it } from 'vitest'
import { SEED_EPOCH, SEED_PLAYER_IDS, buildSeedPlayers, seedPlayerId, slugify } from './seedPlayers'
import type { Player } from './types'

/** The roster as agreed with the club (number -> name). null = no shirt number. */
const EXPECTED_ROSTER: Array<[number | null, string]> = [
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

/** Index lookup that fails loudly instead of returning undefined. */
function get(players: Record<string, Player>, id: string): Player {
  const p = players[id]
  if (!p) throw new Error(`missing seeded player ${id}`)
  return p
}

describe('slugify', () => {
  it('lower-cases and joins words with single dashes', () => {
    expect(slugify('Tom Curtis')).toBe('tom-curtis')
    expect(slugify('Cohen Uri')).toBe('cohen-uri')
    expect(slugify('  Tom   Curtis ')).toBe('tom-curtis')
  })

  it('strips accents and diacritics', () => {
    expect(slugify('Émile Zoë')).toBe('emile-zoe')
    expect(slugify('Ñandú')).toBe('nandu')
    expect(slugify('Jürgen Müller')).toBe('jurgen-muller')
    expect(slugify('Vujović Filip')).toBe('vujovic-filip')
    expect(slugify('Čeh Dušan')).toBe('ceh-dusan')
  })

  it('turns punctuation into dashes and trims leading/trailing dashes', () => {
    expect(slugify("O'Brien")).toBe('o-brien')
    expect(slugify('Player #33!')).toBe('player-33')
    expect(slugify('--Dahan--Yiftach--')).toBe('dahan-yiftach')
    expect(slugify('a.b_c/d')).toBe('a-b-c-d')
  })

  it('collapses to empty for names with no Latin letters or digits', () => {
    // Documented limitation: the seed roster is Latin-script, so this never
    // happens for seeded players; manually added players get random ids instead.
    expect(slugify('')).toBe('')
    expect(slugify('---')).toBe('')
    expect(slugify('שלום')).toBe('')
  })

  it('is idempotent', () => {
    for (const [, name] of EXPECTED_ROSTER) {
      expect(slugify(slugify(name))).toBe(slugify(name))
    }
  })
})

describe('seedPlayerId', () => {
  it('is deterministic: p-<slug>', () => {
    expect(seedPlayerId('Tom Curtis')).toBe('p-tom-curtis')
    expect(seedPlayerId('Kusturlic Jarko')).toBe('p-kusturlic-jarko')
    expect(seedPlayerId('Cohen Uri')).toBe('p-cohen-uri')
    expect(seedPlayerId('Tom Curtis')).toBe(seedPlayerId('Tom Curtis'))
  })
})

describe('SEED_EPOCH', () => {
  it('is an ISO UTC stamp far enough in the past that any real edit wins a merge', () => {
    expect(SEED_EPOCH).toBe('2020-01-01T00:00:00.000Z')
    expect(new Date(SEED_EPOCH).toISOString()).toBe(SEED_EPOCH)
    expect(SEED_EPOCH < new Date().toISOString()).toBe(true)
  })
})

describe('buildSeedPlayers', () => {
  it('builds exactly the 14 roster players keyed by their deterministic ids', () => {
    const players = buildSeedPlayers()
    expect(Object.keys(players)).toHaveLength(14)
    expect(Object.keys(players)).toEqual(EXPECTED_ROSTER.map(([, name]) => seedPlayerId(name)))
    for (const [id, p] of Object.entries(players)) expect(p.id).toBe(id)
  })

  it('carries the roster numbers, with null for the two unnumbered players', () => {
    const players = buildSeedPlayers()
    for (const [number, name] of EXPECTED_ROSTER) {
      const p = get(players, seedPlayerId(name))
      expect(p.name).toBe(name)
      expect(p.number).toBe(number)
    }
    expect(get(players, 'p-kusturlic-jarko').number).toBe(1)
    expect(get(players, 'p-cohen-uri').number).toBe(33)
    expect(get(players, 'p-tom-curtis').number).toBeNull()
    expect(get(players, 'p-shalev-aharoni').number).toBeNull()
  })

  it('shirt numbers are unique among numbered players', () => {
    const numbers = Object.values(buildSeedPlayers())
      .map((p) => p.number)
      .filter((n): n is number => n !== null)
    expect(numbers).toHaveLength(12)
    expect(new Set(numbers).size).toBe(12)
  })

  it('marks every player seeded, not deleted, stamped with SEED_EPOCH by the manager', () => {
    for (const p of Object.values(buildSeedPlayers())) {
      expect(p.seeded).toBe(true)
      expect(p.deleted).toBe(false)
      expect(p.updatedAt).toBe(SEED_EPOCH)
      expect(p.updatedBy).toBe('shahar')
    }
  })

  it('starts every profile field empty', () => {
    for (const p of Object.values(buildSeedPlayers())) {
      expect(p.fitnessLevel).toBe('')
      expect(p.bodyStructure).toBe('')
      expect(p.bodyType).toBe('')
      expect(p.pastInjuries).toBe('')
      expect(p.rom).toBe('')
      expect(p.strengthening).toBe('')
    }
  })

  it('returns fresh objects on every call (no shared mutable state)', () => {
    const a = buildSeedPlayers()
    const b = buildSeedPlayers()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(get(a, 'p-tom-curtis')).not.toBe(get(b, 'p-tom-curtis'))
    get(a, 'p-tom-curtis').number = 99
    expect(get(b, 'p-tom-curtis').number).toBeNull()
    expect(get(buildSeedPlayers(), 'p-tom-curtis').number).toBeNull()
  })
})

describe('SEED_PLAYER_IDS', () => {
  it('lists the 14 unique ids in roster order, matching buildSeedPlayers', () => {
    expect(SEED_PLAYER_IDS).toHaveLength(14)
    expect(new Set(SEED_PLAYER_IDS).size).toBe(14)
    expect([...SEED_PLAYER_IDS]).toEqual(Object.keys(buildSeedPlayers()))
    expect(SEED_PLAYER_IDS).toContain('p-tom-curtis')
    expect(SEED_PLAYER_IDS).toContain('p-cohen-uri')
    for (const id of SEED_PLAYER_IDS) expect(id.startsWith('p-')).toBe(true)
  })
})
