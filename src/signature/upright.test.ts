import { describe, expect, it } from 'vitest'
import type { Rect } from '../pipeline/types'
import { uprightTurns } from './upright'

function maskOf(rows: string[]): { mask: Float32Array; width: number; ink: Rect } {
  const width = rows[0].length
  const mask = new Float32Array(rows.length * width)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (mask[y * width + x] = ch === '#' ? 1 : 0)))
  return { mask, width, ink: { x: 0, y: 0, width, height: rows.length } }
}

/** Turn a picture a quarter turn clockwise. */
const clockwise = (rows: string[]) =>
  Array.from({ length: rows[0].length }, (_, x) =>
    Array.from({ length: rows.length }, (_, y) => rows[rows.length - 1 - y][x]).join(''),
  )

// a word with tall strokes reaching up from a dense body, and an underline beneath
const upright = [
  '#......#.......#....',
  '#......#.......#....',
  '#.##.#.#.###.#.#.##.',
  '####.###.#.#.###.##.',
  '....................',
  '###################.',
]

const guess = (rows: string[]) => {
  const { mask, width, ink } = maskOf(rows)
  return uprightTurns(mask, width, ink)
}

describe('uprightTurns', () => {
  it('leaves an upright signature alone', () => {
    expect(guess(upright)).toEqual({ turns: 0, confident: true })
  })

  it('turns an upside-down signature half way round', () => {
    expect(guess(clockwise(clockwise(upright)))).toEqual({ turns: 2, confident: true })
  })

  it('undoes a quarter turn in either direction', () => {
    // turned clockwise once: three more clockwise turns bring it back
    expect(guess(clockwise(upright))).toEqual({ turns: 3, confident: true })
    // turned clockwise three times: one more brings it back
    expect(guess(clockwise(clockwise(clockwise(upright))))).toEqual({ turns: 1, confident: true })
  })

  it('applying the answer always gives an upright picture', () => {
    let picture = upright
    for (let made = 0; made < 4; made++) {
      let fixed = picture
      for (let i = 0; i < guess(picture).turns; i++) fixed = clockwise(fixed)
      expect(fixed).toEqual(upright)
      picture = clockwise(picture)
    }
  })

  it('reads only the ink inside the rectangle', () => {
    const { mask, width } = maskOf(['....................', ...upright, '####################'])
    const ink = { x: 0, y: 1, width, height: upright.length }
    expect(uprightTurns(mask, width, ink).turns).toBe(0)
  })

  it('is not confident about ink that is balanced top to bottom', () => {
    expect(guess(['####', '....', '####']).confident).toBe(false)
  })

  it('does not turn a picture upside down on weak evidence', () => {
    // slightly top-heavy, but nowhere near enough to be sure
    const rows = ['#####################', '.....................', '####################.']
    expect(guess(rows)).toEqual({ turns: 0, confident: false })
  })

  it('still picks a direction for a sideways signature on weak evidence', () => {
    const result = guess(['#.#', '#.#', '#.#', '#.#', '#.#', '#.#'])
    expect(result.confident).toBe(false)
    expect([1, 3]).toContain(result.turns)
  })

  it('is not confident about an empty mask', () => {
    expect(guess(['....', '....'])).toEqual({ turns: 0, confident: false })
  })
})
