import { describe, expect, it } from 'vitest'
import { dilate, limitTo, softOutside } from './gate'

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

describe('softOutside', () => {
  // one row is enough: 9 = solid, 5 = soft, 0 = nothing
  const run = (mask: string, who: string, margin: number) => {
    const m = grid([mask])
    return digits(softOutside(m.mask, grid([who]).mask, m.width, m.height, margin), m.width)[0]
  }

  it('keeps soft values outside who and removes solid ones', () => {
    //            mask        who
    expect(run('9950990', '9900000', 0)).toBe('9950000')
  })

  it('also removes soft values within the margin of a removed solid pixel', () => {
    expect(run('9905990', '9900000', 1)).toBe('9900000')
  })

  it('leaves soft values alone when they are farther away than the margin', () => {
    expect(run('9950099', '9900000', 1)).toBe('9950000')
  })

  it('changes nothing inside who, even next to a removed pixel', () => {
    expect(run('9999', '9900', 1)).toBe('9900')
    expect(run('999', '999', 4)).toBe('999')
  })

  it('treats a value just under solid as soft', () => {
    expect(run('980', '900', 0)).toBe('980')
  })

  it('returns a new array and leaves the input alone', () => {
    const m = grid(['990'])
    const out = softOutside(m.mask, grid(['900']).mask, m.width, m.height, 0)
    expect(out).not.toBe(m.mask)
    expect(digits(m.mask, m.width)[0]).toBe('990')
  })
})
