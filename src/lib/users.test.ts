import { describe, expect, it } from 'vitest'
import type { UserId } from './types'
import { isUserId, userName } from './users'

describe('userName', () => {
  it('names the three physios', () => {
    expect(userName('shahar')).toBe('Shahar')
    expect(userName('maya')).toBe('Maya')
    expect(userName('neta')).toBe('Neta')
  })

  it('is total: null and an id that is no longer valid (old build, edited file) both render as Unknown', () => {
    expect(userName(null)).toBe('Unknown')
    expect(isUserId('shachar')).toBe(false)
    expect(() => userName('shachar' as UserId)).not.toThrow()
    expect(userName('shachar' as UserId)).toBe('Unknown')
  })
})
