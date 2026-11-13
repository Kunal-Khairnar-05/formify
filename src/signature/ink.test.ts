import { describe, expect, it } from 'vitest'
import { darkness, inkBounds, inkMask, luminance } from './ink'

/** Build a brightness grid from rows of digits: '0' = black, '9' = white. */
function grid(rows: string[]): { gray: Float32Array; width: number; height: number } {
  const width = rows[0].length
  const gray = new Float32Array(rows.length * width)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (gray[y * width + x] = Number(ch) / 9)))
  return { gray, width, height: rows.length }
}

/** Build a mask from rows: '#' = ink, anything else = paper. */
function maskOf(rows: string[]): { mask: Float32Array; width: number; height: number } {
  const width = rows[0].length
  const mask = new Float32Array(rows.length * width)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (mask[y * width + x] = ch === '#' ? 1 : 0)))
  return { mask, width, height: rows.length }
}

const picture = (mask: Float32Array, width: number) =>
  Array.from({ length: mask.length / width }, (_, y) =>
    Array.from(mask.slice(y * width, (y + 1) * width), (v) => (v > 0.5 ? '#' : '.')).join(''),
  )

/** The ink found in a brightness grid, as a picture. */
const inkOf = (rows: string[], radius: number, contrast = 0.1) => {
  const { gray, width, height } = grid(rows)
  return picture(inkMask(darkness(gray, width, height, radius), contrast), width)
}

describe('luminance', () => {
  const pixel = (r: number, g: number, b: number) =>
    luminance({ data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 })[0]

  it('is 0 for black and 1 for white', () => {
    expect(pixel(0, 0, 0)).toBe(0)
    expect(pixel(255, 255, 255)).toBeCloseTo(1)
  })

  it('weights green most and blue least', () => {
    expect(pixel(255, 0, 0)).toBeCloseTo(0.299)
    expect(pixel(0, 255, 0)).toBeCloseTo(0.587)
    expect(pixel(0, 0, 255)).toBeCloseTo(0.114)
  })

  it('ignores alpha and reads every pixel', () => {
    const gray = luminance({
      data: new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255, 128, 128, 128, 7]),
      width: 3,
      height: 1,
    })
    expect(gray).toHaveLength(3)
    expect(gray[0]).toBeCloseTo(1)
    expect(gray[1]).toBe(0)
    expect(gray[2]).toBeCloseTo(128 / 255)
  })
})

describe('darkness', () => {
  it('is 0 on blank paper, light or dark', () => {
    for (const row of ['99999', '55555', '22222']) {
      const { gray, width, height } = grid([row, row, row])
      expect(Math.max(...darkness(gray, width, height, 1))).toBe(0)
    }
  })

  it('is the drop below the paper on a thin stroke, and 0 beside it', () => {
    const { gray, width, height } = grid(['99999', '99199', '99999'])
    const dark = darkness(gray, width, height, 1)
    expect(dark[1 * width + 2]).toBeCloseTo(8 / 9)
    expect(dark[1 * width + 1]).toBe(0)
    expect(dark[0]).toBe(0)
  })

  it('is never negative', () => {
    const { gray, width, height } = grid(['11111', '11911', '11111'])
    expect(Math.min(...darkness(gray, width, height, 1))).toBe(0)
  })
})

describe('inkMask', () => {
  it('is 0 up to the contrast, 1 from twice the contrast, and soft in between', () => {
    const mask = inkMask(new Float32Array([0, 0.05, 0.1, 0.15, 0.2, 0.6]), 0.1)
    expect(mask[0]).toBe(0)
    expect(mask[1]).toBe(0)
    expect(mask[2]).toBeCloseTo(0)
    expect(mask[3]).toBeCloseTo(0.5)
    expect(mask[4]).toBeCloseTo(1)
    expect(mask[5]).toBe(1)
  })
})

describe('darkness and inkMask together', () => {
  it('mark a dark stroke on light paper', () => {
    expect(inkOf(['99999', '99199', '99199', '99199', '99999'], 2)).toEqual([
      '.....',
      '..#..',
      '..#..',
      '..#..',
      '.....',
    ])
  })

  it('find the stroke under a shadow, where the paper itself is dark', () => {
    // the page gets darker from left to right, the way a shadow falls; one stroke on each side
    const rows = inkOf(
      [
        '9998887776665554',
        '9998887776665554',
        '9911117776000054',
        '9998887776665554',
        '9998887776665554',
      ],
      2,
    )
    expect(rows[2]).toBe('..####....####..')
    // the paper on the right is darker than much of the left, yet it is not ink
    expect(rows[0]).toBe('................')
    expect(rows[4]).toBe('................')
  })

  it('mark nothing at a hard edge, such as the border of the paper on a dark table', () => {
    const row = '9999992222222'
    expect(inkOf([row, row, row], 2)).toEqual(['.............', '.............', '.............'])
  })

  it('mark nothing on a dark area wider than the radius, but find a stroke beside it', () => {
    expect(
      inkOf(
        [
          '2222229999999',
          '2222229999999',
          '2222229991999',
          '2222229991999',
          '2222229999999',
          '2222229999999',
        ],
        2,
      ),
    ).toEqual([
      '.............',
      '.............',
      '.........#...',
      '.........#...',
      '.............',
      '.............',
    ])
  })

  it('keep a stroke up to twice the radius wide, and drop a wider one', () => {
    const four = '9911119999'
    expect(inkOf([four, four, four], 2)[1]).toBe('..####....')
    // 5 px wide: the bright paper reaches only 2 px in from each side, never the middle
    const five = '9911111999'
    expect(inkOf([five, five, five], 2)[1]).toBe('..........')
  })

  it('ignore faint texture below the contrast', () => {
    const gray = Float32Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? 0.8 : 0.76))
    expect(Math.max(...inkMask(darkness(gray, 5, 3, 1), 0.1))).toBe(0)
  })
})

describe('inkBounds', () => {
  it('returns the rectangle around the ink', () => {
    const { mask, width, height } = maskOf(['......', '..##..', '.###..', '..#...', '......'])
    expect(inkBounds(mask, width, height, 1)).toEqual({ x: 1, y: 1, width: 3, height: 3 })
  })

  it('returns null when there is no ink', () => {
    const { mask, width, height } = maskOf(['....', '....'])
    expect(inkBounds(mask, width, height, 1)).toBeNull()
  })

  it('covers the whole image when ink touches every edge', () => {
    const { mask, width, height } = maskOf(['###', '###'])
    expect(inkBounds(mask, width, height, 1)).toEqual({ x: 0, y: 0, width: 3, height: 2 })
  })

  it('ignores a stray speck far from the signature', () => {
    const { mask, width, height } = maskOf([
      '#.........',
      '..........',
      '....###...',
      '....###...',
      '....###...',
      '..........',
    ])
    expect(inkBounds(mask, width, height, 2)).toEqual({ x: 4, y: 2, width: 3, height: 3 })
    // with a count of 1 the speck is included
    expect(inkBounds(mask, width, height, 1)).toEqual({ x: 0, y: 0, width: 7, height: 5 })
  })

  it('returns null when nothing reaches the count', () => {
    const { mask, width, height } = maskOf(['#...', '...#'])
    expect(inkBounds(mask, width, height, 2)).toBeNull()
  })

  it('counts only pixels that are more ink than paper', () => {
    const mask = new Float32Array([0.4, 0.6, 0.5, 0.9])
    expect(inkBounds(mask, 4, 1, 1)).toEqual({ x: 1, y: 0, width: 3, height: 1 })
  })
})
