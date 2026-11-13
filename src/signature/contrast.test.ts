import { describe, expect, it } from 'vitest'
import { pickContrast } from './contrast'

/** A page of `size` pixels at 0 darkness, with `count` pixels set to each given darkness. */
function page(size: number, marks: [darkness: number, count: number][]): Float32Array {
  const dark = new Float32Array(size)
  let at = 0
  for (const [value, count] of marks) {
    dark.fill(value, at, at + count)
    at += count
  }
  return dark
}

describe('pickContrast', () => {
  it('falls back to the minimum on a blank page', () => {
    expect(pickContrast(page(10_000, []))).toBeCloseTo(0.08)
  })

  it('stays at the minimum for faint ink', () => {
    // 0.2 * 0.3 = 0.06, below the minimum
    expect(pickContrast(page(10_000, [[0.2, 200]]))).toBeCloseTo(0.08)
  })

  it('rises with dark ink, to a share of its darkness', () => {
    const contrast = pickContrast(page(10_000, [[0.6, 200]]))
    expect(contrast).toBeGreaterThan(0.17)
    expect(contrast).toBeLessThan(0.19)
  })

  it('puts faint ruled lines below the cut when the ink is dark', () => {
    // many line pixels at 0.1, fewer ink pixels at 0.6
    const contrast = pickContrast(
      page(100_000, [
        [0.6, 1_500],
        [0.1, 6_000],
      ]),
    )
    expect(contrast).toBeGreaterThan(0.1)
    expect(contrast).toBeLessThan(0.3)
  })

  it('is not set by a handful of very dark specks', () => {
    // 5 pixels in 100,000 is well under the top 0.1%
    expect(pickContrast(page(100_000, [[1, 5]]))).toBeCloseTo(0.08)
  })

  it('never goes below the minimum or above the darkest ink', () => {
    for (const value of [0.05, 0.3, 0.7, 1]) {
      const contrast = pickContrast(page(10_000, [[value, 500]]))
      expect(contrast).toBeGreaterThanOrEqual(0.08 - 1e-9)
      expect(contrast).toBeLessThanOrEqual(Math.max(0.08, value))
    }
  })
})
