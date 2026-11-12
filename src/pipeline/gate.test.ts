import { describe, expect, it } from 'vitest'
import { dilate, limitTo } from './gate'

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

describe('dilate', () => {
  it('grows a single pixel into a square of the given radius', () => {
    const { mask, width, height } = grid([
      '00000',
      '00000',
      '00900',
      '00000',
      '00000',
    ])
    expect(digits(dilate(mask, width, height, 1), width)).toEqual([
      '00000',
      '09990',
      '09990',
      '09990',
      '00000',
    ])
  })

  it('takes the largest nearby value, so soft values spread too', () => {
    const { mask, width, height } = grid(['0000', '0390', '0000'])
    expect(digits(dilate(mask, width, height, 1), width)).toEqual(['3999', '3999', '3999'])
  })

  it('stops at the edges of the image', () => {
    const { mask, width, height } = grid(['900', '000', '000'])
    expect(digits(dilate(mask, width, height, 1), width)).toEqual(['990', '990', '000'])
  })

  it('returns a copy when the radius is 0', () => {
    const { mask, width, height } = grid(['090', '000'])
    const out = dilate(mask, width, height, 0)
    expect(digits(out, width)).toEqual(['090', '000'])
    expect(out).not.toBe(mask)
  })

  it('leaves the input alone', () => {
    const { mask, width, height } = grid(['000', '090', '000'])
    dilate(mask, width, height, 1)
    expect(digits(mask, width)).toEqual(['000', '090', '000'])
  })
})

describe('limitTo', () => {
  it('keeps the matte where the gate is open and removes it where the gate is closed', () => {
    const matte = new Float32Array([1, 0.6, 1, 0.3])
    const gate = new Float32Array([1, 1, 0, 0])
    const out = limitTo(matte, gate)
    expect(out[0]).toBeCloseTo(1)
    expect(out[1]).toBeCloseTo(0.6)
    expect(out[2]).toBeCloseTo(0)
    expect(out[3]).toBeCloseTo(0)
  })

  it('takes the smaller value where both are partial', () => {
    const out = limitTo(new Float32Array([0.8, 0.2]), new Float32Array([0.5, 0.5]))
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[1]).toBeCloseTo(0.2)
  })

  it('never adds anything the matte did not have', () => {
    const out = limitTo(new Float32Array([0, 0]), new Float32Array([1, 1]))
    expect(Array.from(out)).toEqual([0, 0])
  })
})
