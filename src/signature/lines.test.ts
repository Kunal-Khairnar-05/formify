import { describe, expect, it } from 'vitest'
import { dropFragments, dropLines } from './lines'

const WIDTH = 200
const HEIGHT = 120

/** A blank darkness map with helpers to draw on it. */
function page() {
  const dark = new Float32Array(WIDTH * HEIGHT)
  const set = (x: number, y: number) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) dark[Math.round(y) * WIDTH + Math.round(x)] = 0.6
  }
  return {
    dark,
    /** A line from side to side, `thickness` px thick, dropping `slope` px per px across. */
    ruled(y: number, thickness = 2, slope = 0) {
      for (let x = 0; x < WIDTH; x++) {
        for (let t = 0; t < thickness; t++) set(x, y + x * slope + t)
      }
    },
    margin(x: number) {
      for (let y = 0; y < HEIGHT; y++) {
        set(x, y)
        set(x + 1, y)
      }
    },
    /** A zigzag like handwriting: thin diagonal strokes between two heights. */
    writing(fromX: number, toX: number, top: number, bottom: number) {
      let y = bottom
      let step = -1
      for (let x = fromX; x < toX; x++) {
        for (let t = 0; t < 3; t++) set(x, y + t)
        y += step * 2
        set(x, y)
        set(x, y + 1)
        if (y <= top || y >= bottom) step = -step
      }
    },
  }
}

const count = (values: Float32Array, x0: number, y0: number, x1: number, y1: number) => {
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (values[y * WIDTH + x] > 0.3) n++
  }
  return n
}

describe('dropLines', () => {
  it('clears a ruled line that runs from side to side', () => {
    const p = page()
    p.ruled(40)
    expect(count(dropLines(p.dark, WIDTH, HEIGHT, 0.2), 0, 0, WIDTH, HEIGHT)).toBe(0)
  })

  it('clears a margin line that runs from top to bottom', () => {
    const p = page()
    p.margin(30)
    expect(count(dropLines(p.dark, WIDTH, HEIGHT, 0.2), 0, 0, WIDTH, HEIGHT)).toBe(0)
  })

  it('clears a line that is a little off level', () => {
    const p = page()
    p.ruled(30, 2, 0.03) // about 1.7 degrees
    const before = count(p.dark, 0, 0, WIDTH, HEIGHT)
    const after = count(dropLines(p.dark, WIDTH, HEIGHT, 0.2), 0, 0, WIDTH, HEIGHT)
    expect(after).toBeLessThan(before * 0.05)
  })

  it('clears a thick line that bows, as a page does in a photo', () => {
    const p = page()
    // 4 px thick, 4 px lower at both ends than in the middle
    for (let x = 0; x < WIDTH; x++) {
      const u = (x - WIDTH / 2) / (WIDTH / 2)
      const y = Math.round(80 + 4 * u * u)
      for (let t = 0; t < 4; t++) p.dark[(y + t) * WIDTH + x] = 0.6
    }
    p.writing(50, 150, 30, 60)
    const out = dropLines(p.dark, WIDTH, HEIGHT, 0.2)
    // nothing of the line is left, not even its ends
    expect(count(out, 0, 70, WIDTH, HEIGHT)).toBe(0)
    expect(count(out, 0, 0, WIDTH, 70)).toBe(count(p.dark, 0, 0, WIDTH, 70))
  })

  it('leaves handwriting alone when there are no lines', () => {
    const p = page()
    p.writing(60, 140, 40, 70)
    const out = dropLines(p.dark, WIDTH, HEIGHT, 0.2)
    expect(Array.from(out)).toEqual(Array.from(p.dark))
  })

  it('keeps the handwriting and clears the lines around it', () => {
    const p = page()
    p.writing(60, 140, 40, 68)
    const inkBefore = count(p.dark, 60, 36, 140, 66)
    p.ruled(20)
    p.ruled(70) // the writing sits on this one
    p.ruled(100)
    p.margin(25)
    const out = dropLines(p.dark, WIDTH, HEIGHT, 0.2)
    // the lines away from the writing are gone
    expect(count(out, 0, 15, WIDTH, 25)).toBe(0)
    expect(count(out, 0, 95, WIDTH, 105)).toBe(0)
    // the line the writing sits on is gone where the writing is not
    expect(count(out, 0, 68, 55, 74)).toBe(0)
    expect(count(out, 150, 68, WIDTH, 74)).toBe(0)
    // and the body of the writing, above that line, is untouched
    expect(count(out, 60, 36, 140, 66)).toBe(inkBefore)
  })

  it('keeps a short underline that does not reach the sides', () => {
    const p = page()
    for (let x = 60; x < 140; x++) {
      p.dark[90 * WIDTH + x] = 0.6
      p.dark[91 * WIDTH + x] = 0.6
    }
    const out = dropLines(p.dark, WIDTH, HEIGHT, 0.2)
    expect(count(out, 0, 0, WIDTH, HEIGHT)).toBe(160)
  })

  it('does not modify its input', () => {
    const p = page()
    p.ruled(40)
    const copy = new Float32Array(p.dark)
    dropLines(p.dark, WIDTH, HEIGHT, 0.2)
    expect(p.dark).toEqual(copy)
  })
})

describe('dropFragments', () => {
  const blank = () => new Float32Array(WIDTH * HEIGHT)
  const fill = (mask: Float32Array, x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) mask[y * WIDTH + x] = 1
  }

  it('clears specks', () => {
    const mask = blank()
    fill(mask, 10, 10, 2, 2)
    fill(mask, 50, 50, 1, 1)
    expect(count(dropFragments(mask, WIDTH, HEIGHT), 0, 0, WIDTH, HEIGHT)).toBe(0)
  })

  it('clears short thin slivers, flat or upright', () => {
    const mask = blank()
    fill(mask, 10, 10, 9, 1)
    fill(mask, 60, 20, 1, 8)
    expect(count(dropFragments(mask, WIDTH, HEIGHT), 0, 0, WIDTH, HEIGHT)).toBe(0)
  })

  it('keeps a dot, which is small but not a sliver', () => {
    const mask = blank()
    fill(mask, 40, 40, 3, 3)
    expect(count(dropFragments(mask, WIDTH, HEIGHT), 0, 0, WIDTH, HEIGHT)).toBe(9)
  })

  it('keeps a long straight underline', () => {
    const mask = blank()
    fill(mask, 20, 80, 120, 2)
    expect(count(dropFragments(mask, WIDTH, HEIGHT), 0, 0, WIDTH, HEIGHT)).toBe(240)
  })

  it('keeps a stroke that is not thin', () => {
    const mask = blank()
    fill(mask, 20, 20, 30, 20)
    expect(count(dropFragments(mask, WIDTH, HEIGHT), 0, 0, WIDTH, HEIGHT)).toBe(600)
  })
})
