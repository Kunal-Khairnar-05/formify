import { describe, expect, it } from 'vitest'
import { minTarget } from './exportJpeg'

describe('minTarget', () => {
  it('aims 5% above the minimum, counting 1 KB as 1024 bytes', () => {
    expect(minTarget(20)).toBe(21_504)
    expect(minTarget(20, 50)).toBe(21_504)
  })

  it('rounds up, never down', () => {
    // 3 KB gives 3225.6 bytes
    expect(minTarget(3)).toBe(3_226)
  })

  it('stays under the maximum margin when the range is narrow', () => {
    // wanted 49,459 bytes, but 5% under 50 KB is 47,500
    expect(minTarget(46, 50)).toBe(47_500)
  })

  it('aims for the middle of a range too narrow for either margin', () => {
    // allowed: 49,152 to 50,000 bytes
    expect(minTarget(48, 50)).toBe(49_576)
  })

  it('is always at or above the strict minimum when the range allows it', () => {
    for (const [min, max] of [
      [10, 20],
      [20, 50],
      [46, 50],
      [48, 50],
      [97, 100],
      [100, 200],
    ]) {
      expect(minTarget(min, max)).toBeGreaterThanOrEqual(min * 1024)
      expect(minTarget(min, max)).toBeLessThanOrEqual(max * 1000)
    }
  })
})
