import { describe, expect, it } from 'vitest'
import { boxBlur, erode, softenEdge } from './edge'

/** Build a mask from rows of digits: '0' = 0, '9' = 1, other digits in between. */
function grid(rows: string[]): { mask: Float32Array; width: number; height: number } {
  const width = rows[0].length
  const mask = new Float32Array(rows.length * width)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (mask[y * width + x] = Number(ch) / 9)))
  return { mask, width, height: rows.length }
}

const digits = (mask: Float32Array, width: number) =>
  Array.from({ length: mask.length / width }, (_, y) =>
    Array.from(mask.slice(y * width, (y + 1) * width), (v) => Math.round(v * 9)).join(''),
  )

const row = (fn: typeof erode, input: string, radius: number) => {
  const { mask, width, height } = grid([input])
  return digits(fn(mask, width, height, radius), width)[0]
}

describe('erode', () => {
  it('shrinks a region by the radius on each side', () => {
    expect(row(erode, '0999990', 1)).toBe('0099900')
    expect(row(erode, '0999990', 2)).toBe('0009000')
  })

  it('removes a region thinner than twice the radius', () => {
    expect(row(erode, '0099000', 1)).toBe('0000000')
  })

  it('does not shrink away from the image border', () => {
    // a person cut off by the bottom of the photo must stay attached to that edge
    expect(row(erode, '9999000', 1)).toBe('9990000')
    expect(row(erode, '999', 1)).toBe('999')
  })

  it('works in both directions', () => {
    const { mask, width, height } = grid(['00000', '09990', '09990', '09990', '00000'])
    expect(digits(erode(mask, width, height, 1), width)).toEqual([
      '00000',
      '00000',
      '00900',
      '00000',
      '00000',
    ])
  })

  it('returns a copy when the radius is 0', () => {
    const { mask, width, height } = grid(['090'])
    const out = erode(mask, width, height, 0)
    expect(digits(out, width)).toEqual(['090'])
    expect(out).not.toBe(mask)
  })
})

describe('boxBlur', () => {
  it('spreads a single pixel evenly over its window', () => {
    expect(row(boxBlur, '0009000', 1)).toBe('0033300')
  })

  it('leaves a flat area flat, including at the border', () => {
    expect(row(boxBlur, '99999', 2)).toBe('99999')
    expect(row(boxBlur, '00000', 2)).toBe('00000')
  })

  it('turns a hard step into a ramp', () => {
    expect(row(boxBlur, '0009999', 1)).toBe('0036999')
  })

  it('blurs down columns as well as along rows', () => {
    const { mask, width, height } = grid(['00000', '00000', '00900', '00000', '00000'])
    const out = boxBlur(mask, width, height, 1)
    // 1/9 of the value lands on every pixel of the 3 x 3 window around it, nothing beyond
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inWindow = x >= 1 && x <= 3 && y >= 1 && y <= 3
        expect(out[y * width + x]).toBeCloseTo(inWindow ? 1 / 9 : 0)
      }
    }
  })
})

describe('softenEdge', () => {
  it('pulls the edge in, then feathers it', () => {
    // erode by 1: 0009999000, then blur by 1
    expect(row(softenEdge, '0099999900', 1)).toBe('0036996300')
  })

  it('never reaches outside the original region', () => {
    const { mask, width, height } = grid(['0099999900'])
    const out = softenEdge(mask, width, height, 1)
    expect(out[0]).toBe(0)
    expect(out[1]).toBe(0)
    expect(out[8]).toBe(0)
    expect(out[9]).toBe(0)
  })

  it('keeps the inside fully opaque', () => {
    const { mask, width, height } = grid(['0999999990'])
    const out = softenEdge(mask, width, height, 1)
    expect(out[4]).toBeCloseTo(1)
    expect(out[5]).toBeCloseTo(1)
  })
})
