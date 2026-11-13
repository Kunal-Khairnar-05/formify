import { describe, expect, it } from 'vitest'
import { inkColour, sharpen, thickenBy } from './paint'

describe('inkColour', () => {
  it('averages the pixels that are clearly ink', () => {
    // two ink pixels, one paper pixel
    const data = [10, 20, 100, 255, 30, 40, 120, 255, 230, 230, 220, 255]
    expect(inkColour(data, new Float32Array([1, 0.9, 0]))).toEqual([20, 30, 110])
  })

  it('ignores soft edge pixels, which are mixed with paper', () => {
    const data = [10, 20, 100, 255, 150, 150, 160, 255]
    expect(inkColour(data, new Float32Array([1, 0.5]))).toEqual([10, 20, 100])
  })

  it('returns null when nothing is clearly ink', () => {
    expect(inkColour([1, 2, 3, 255], new Float32Array([0.3]))).toBeNull()
  })
})

describe('thickenBy', () => {
  it('leaves the strokes alone when the picture is hardly shrunk', () => {
    expect(thickenBy(0.5)).toBe(0)
    expect(thickenBy(1)).toBe(0)
    expect(thickenBy(1.5)).toBe(0)
  })

  it('thickens more the more the picture is shrunk', () => {
    expect(thickenBy(4)).toBeGreaterThan(0)
    expect(thickenBy(8)).toBeGreaterThan(thickenBy(4))
  })

  it('keeps a 2 px stroke at about 1.4 px after shrinking', () => {
    for (const shrink of [3, 4, 6, 10]) {
      const after = (2 + 2 * thickenBy(shrink)) / shrink
      expect(after).toBeGreaterThan(1)
      expect(after).toBeLessThan(1.9)
    }
  })
})

describe('sharpen', () => {
  it('sends faint edges to paper and strong ones to ink', () => {
    expect(sharpen(0)).toBe(0)
    expect(sharpen(0.3)).toBe(0)
    expect(sharpen(0.7)).toBe(1)
    expect(sharpen(1)).toBe(1)
  })

  it('keeps the half-way point where it is', () => {
    expect(sharpen(0.5)).toBeCloseTo(0.5)
  })

  it('rises steadily in between', () => {
    let previous = 0
    for (let a = 0.3; a <= 0.7; a += 0.05) {
      const value = sharpen(a)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})
