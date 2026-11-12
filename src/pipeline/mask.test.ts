import { describe, expect, it } from 'vitest'
import { hairTop, keepConnected, sharpenMask } from './mask'
import type { FaceGeometry } from './types'

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

describe('sharpenMask', () => {
  it('sends values at or below the low mark to 0 and at or above the high mark to 1', () => {
    const out = sharpenMask(new Float32Array([0, 0.2, 0.4, 0.8, 0.9, 1]))
    const expected = [0, 0, 0, 1, 1, 1]
    expected.forEach((value, i) => expect(out[i]).toBeCloseTo(value))
  })

  it('maps the midpoint to one half and keeps the order of values', () => {
    const out = sharpenMask(new Float32Array([0.5, 0.6, 0.7]))
    expect(out[1]).toBeCloseTo(0.5)
    expect(out[0]).toBeLessThan(out[1])
    expect(out[1]).toBeLessThan(out[2])
  })

  it('returns a new array and leaves the input alone', () => {
    const input = new Float32Array([0.2, 0.9])
    const out = sharpenMask(input)
    expect(out).not.toBe(input)
    expect(input[0]).toBeCloseTo(0.2)
  })
})

describe('keepConnected', () => {
  it('keeps the region that contains the seed and clears the others', () => {
    const { mask, width, height } = grid([
      '99000090',
      '99000099',
      '00000000',
      '00990000',
    ])
    const out = keepConnected(mask, width, height, { x: 0, y: 0 })
    expect(digits(out, width)).toEqual(['99000000', '99000000', '00000000', '00000000'])
  })

  it('follows a region through soft values and keeps them as they are', () => {
    const { mask, width, height } = grid(['9310', '0019', '0000', '9000'])
    const out = keepConnected(mask, width, height, { x: 0, y: 0 })
    expect(digits(out, width)).toEqual(['9310', '0019', '0000', '0000'])
  })

  it('does not join regions that only touch at a corner', () => {
    const { mask, width, height } = grid(['90', '09'])
    const out = keepConnected(mask, width, height, { x: 0, y: 0 })
    expect(digits(out, width)).toEqual(['90', '00'])
  })

  it('returns the mask unchanged when the seed is on the background', () => {
    const { mask, width, height } = grid(['0990', '0990'])
    const out = keepConnected(mask, width, height, { x: 0, y: 0 })
    expect(digits(out, width)).toEqual(['0990', '0990'])
  })

  it('rounds a fractional seed to the nearest pixel', () => {
    const { mask, width, height } = grid(['0090', '0000'])
    const out = keepConnected(mask, width, height, { x: 2.3, y: 0.2 })
    expect(digits(out, width)).toEqual(['0090', '0000'])
  })
})

describe('hairTop', () => {
  // face box spans columns 2..5; the mesh-based crown sits at row 4
  const face: FaceGeometry = {
    box: { x: 2, y: 4, width: 4, height: 3 },
    leftEye: { x: 3, y: 5 },
    rightEye: { x: 4, y: 5 },
    chin: { x: 3.5, y: 7 },
    crown: { x: 3.5, y: 4 },
  }

  it('finds the first row above the crown where the mask is person', () => {
    const { mask, width } = grid([
      '00000000',
      '00000000',
      '00099000',
      '00999900',
      '00999900',
      '00999900',
    ])
    expect(hairTop(mask, width, face)).toBe(2)
  })

  it('ignores mask pixels outside the columns of the face', () => {
    const { mask, width } = grid([
      '90000009',
      '90000009',
      '00000000',
      '00999900',
      '00999900',
    ])
    expect(hairTop(mask, width, face)).toBe(3)
  })

  it('ignores faint values', () => {
    const { mask, width } = grid([
      '00033000',
      '00099000',
      '00999900',
      '00999900',
      '00999900',
    ])
    expect(hairTop(mask, width, face)).toBe(1)
  })

  it('falls back to the mesh crown when the mask has nothing above it', () => {
    const { mask, width } = grid([
      '00000000',
      '00000000',
      '00000000',
      '00000000',
      '00999900',
    ])
    expect(hairTop(mask, width, face)).toBe(4)
  })
})
