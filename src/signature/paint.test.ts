import { describe, expect, it } from 'vitest'
import { inkColour, resizeArea, strokeWidth, thickenBy } from './paint'

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

describe('strokeWidth', () => {
  // a level bar `thick` pixels tall across a 60 x 30 picture
  const bar = (thick: number) => {
    const mask = new Float32Array(60 * 30)
    for (let y = 10; y < 10 + thick; y++) mask.fill(1, y * 60 + 5, y * 60 + 55)
    return strokeWidth(mask, 60, 30)
  }

  it('measures thin and thick strokes', () => {
    expect(bar(2)).toBeCloseTo(2, 0)
    expect(bar(6)).toBeGreaterThan(5)
    expect(bar(6)).toBeLessThan(7)
    expect(bar(12)).toBeGreaterThan(9)
    expect(bar(12)).toBeLessThan(13)
  })

  it('is 0 for an empty mask', () => {
    expect(strokeWidth(new Float32Array(100), 10, 10)).toBe(0)
  })
})

describe('thickenBy', () => {
  it('leaves the strokes alone when the picture is hardly shrunk', () => {
    expect(thickenBy(0.5, 2)).toBe(0)
    expect(thickenBy(1, 2)).toBe(0)
    expect(thickenBy(1.5, 2)).toBe(0)
  })

  it('thickens more the more the picture is shrunk', () => {
    expect(thickenBy(4, 2)).toBeGreaterThan(0)
    expect(thickenBy(8, 2)).toBeGreaterThan(thickenBy(4, 2))
  })

  it('keeps a 2 px stroke at about 1.8 px after shrinking', () => {
    for (const shrink of [3, 4, 6, 10]) {
      const after = (2 + 2 * thickenBy(shrink, 2)) / shrink
      expect(after).toBeGreaterThan(1.3)
      expect(after).toBeLessThan(2.3)
    }
  })

  it('leaves a stroke alone that is already wide enough', () => {
    // a marker stroke 14 px wide, shrunk 7 times, is still 2 px
    expect(thickenBy(7, 14)).toBe(0)
  })
})

describe('resizeArea', () => {
  const whole = (width: number, height: number) => ({ x: 0, y: 0, width, height })

  it('returns the same values when the size does not change', () => {
    const values = new Float32Array([0, 1, 0.5, 0.25])
    expect([...resizeArea(values, 2, 2, whole(2, 2), 2, 2)]).toEqual([0, 1, 0.5, 0.25])
  })

  it('averages every source pixel under an output pixel', () => {
    // 4 x 2 down to 2 x 1: each output pixel is the mean of a 2 x 2 block
    const values = new Float32Array([1, 1, 0, 1, 1, 1, 0, 0])
    const out = resizeArea(values, 4, 2, whole(4, 2), 2, 1)
    expect(out[0]).toBeCloseTo(1)
    expect(out[1]).toBeCloseTo(0.25)
  })

  it('keeps a one-pixel stroke visible however it falls on the output grid', () => {
    // a quick resize that samples one pixel in three would miss two of these three strokes
    for (const x of [3, 4, 5]) {
      const values = new Float32Array(9)
      values[x] = 1
      const out = resizeArea(values, 9, 1, whole(9, 1), 3, 1)
      expect(out[1]).toBeCloseTo(1 / 3)
    }
  })

  it('counts part-covered pixels in part', () => {
    // 3 pixels down to 2: each output pixel covers one and a half
    const out = resizeArea(new Float32Array([1, 0, 0]), 3, 1, whole(3, 1), 2, 1)
    expect(out[0]).toBeCloseTo(1 / 1.5)
    expect(out[1]).toBeCloseTo(0)
  })

  it('reads only the rectangle, and treats outside the map as empty', () => {
    const values = new Float32Array([1, 1, 1, 1])
    const out = resizeArea(values, 2, 2, { x: 1, y: 0, width: 2, height: 2 }, 2, 1)
    expect(out[0]).toBeCloseTo(1)
    expect(out[1]).toBeCloseTo(0)
  })

  it('blends neighbours smoothly when enlarging', () => {
    const out = resizeArea(new Float32Array([0, 0, 1, 1]), 4, 1, whole(4, 1), 8, 1)
    // a step in the source becomes a ramp, not a hard jump
    expect([...out.slice(2, 6)].map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.25, 0.75, 1])
  })
})
