import { describe, expect, it } from 'vitest'
import { area, outlines, pathData, simplify, type Point } from './trace'

/** A map from rows of text: '#' is ink, anything else paper. */
function maskOf(rows: string[]) {
  const width = rows[0].length
  const mask = new Float32Array(rows.length * width)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (mask[y * width + x] = ch === '#' ? 1 : 0)))
  return { mask, width, height: rows.length }
}

const trace = (rows: string[]) => {
  const { mask, width, height } = maskOf(rows)
  return outlines(mask, width, height)
}

const bounds = (loop: Point[]) => ({
  minX: Math.min(...loop.map((p) => p[0])),
  maxX: Math.max(...loop.map((p) => p[0])),
  minY: Math.min(...loop.map((p) => p[1])),
  maxY: Math.max(...loop.map((p) => p[1])),
})

describe('outlines', () => {
  it('finds nothing in an empty map', () => {
    expect(trace(['....', '....'])).toEqual([])
  })

  it('draws one closed outline round a block', () => {
    const loops = trace(['......', '.###..', '.###..', '......'])
    expect(loops).toHaveLength(1)
    // the block covers x 1..4 and y 1..3; with hard 0 and 1 values the edge falls half way
    // between an ink pixel's centre and its paper neighbour's, which is the pixel's own edge
    expect(bounds(loops[0])).toEqual({ minX: 1, maxX: 4, minY: 1, maxY: 3 })
  })

  it('encloses about the area of the ink', () => {
    const [loop] = trace(['........', '.#####..', '.#####..', '.#####..', '........'])
    // 15 pixels, less the four corners that marching squares cuts off
    expect(area(loop)).toBeGreaterThan(13)
    expect(area(loop)).toBeLessThanOrEqual(15)
  })

  it('gives a hole its own outline', () => {
    const loops = trace(['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......'])
    expect(loops).toHaveLength(2)
    const areas = loops.map(area).sort((a, b) => a - b)
    // the hole is inside the outer outline
    expect(areas[0]).toBeLessThan(areas[1])
  })

  it('gives separate strokes separate outlines', () => {
    expect(trace(['##...##', '##...##'])).toHaveLength(2)
  })

  it('closes an outline that runs to the edge of the map', () => {
    const loops = trace(['###', '###'])
    expect(loops).toHaveLength(1)
    expect(bounds(loops[0])).toEqual({ minX: 0, maxX: 3, minY: 0, maxY: 2 })
  })

  it('places the edge between pixels by their values', () => {
    // one row: paper, then a pixel that is 75% ink, then full ink
    const loops = outlines(new Float32Array([0, 0.75, 1, 1, 0]), 5, 1)
    // between the centres at 0.5 (value 0) and 1.5 (value 0.75), 0.5 is reached two thirds of the way
    expect(bounds(loops[0]).minX).toBeCloseTo(0.5 + 0.5 / 0.75)
  })

  it('joins two pixels that touch at a corner, so a thin diagonal stroke stays in one piece', () => {
    expect(trace(['#.', '.#'])).toHaveLength(1)
    expect(trace(['.#', '#.'])).toHaveLength(1)
  })

  it('keeps two faint corners apart when the middle between them is paper', () => {
    // the four values average under the level, so the corners are not one stroke
    expect(outlines(new Float32Array([0.6, 0, 0, 0.6]), 2, 2)).toHaveLength(2)
  })

  it('every outline is closed: each point is used once', () => {
    const loops = trace(['.##..#.', '#####..', '.#.###.', '..##...'])
    for (const loop of loops) {
      const keys = new Set(loop.map(([x, y]) => `${x},${y}`))
      expect(keys.size).toBe(loop.length)
    }
  })
})

describe('simplify', () => {
  // a square with a point at every unit step along its sides
  const square: Point[] = [
    ...Array.from({ length: 10 }, (_, i): Point => [i, 0]),
    ...Array.from({ length: 10 }, (_, i): Point => [10, i]),
    ...Array.from({ length: 10 }, (_, i): Point => [10 - i, 10]),
    ...Array.from({ length: 10 }, (_, i): Point => [0, 10 - i]),
  ]

  it('reduces a square to its four corners', () => {
    const simple = simplify(square, 0.1)
    expect(simple).toHaveLength(4)
    expect(area(simple)).toBeCloseTo(100)
  })

  it('keeps a bump larger than the tolerance and drops one smaller', () => {
    const bumped = square.map(([x, y]): Point => (x === 5 && y === 0 ? [5, -2] : [x, y]))
    expect(simplify(bumped, 0.5).some(([x, y]) => x === 5 && y === -2)).toBe(true)
    expect(simplify(bumped, 3).some(([x, y]) => x === 5 && y === -2)).toBe(false)
  })

  it('leaves a very short outline alone', () => {
    const triangle: Point[] = [
      [0, 0],
      [4, 0],
      [0, 3],
    ]
    expect(simplify(triangle, 5)).toEqual(triangle)
  })

  it('never strays further than the tolerance', () => {
    // a circle of 200 points
    const circle = Array.from({ length: 200 }, (_, i): Point => {
      const a = (i / 200) * Math.PI * 2
      return [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)]
    })
    const simple = simplify(circle, 0.5)
    expect(simple.length).toBeLessThan(60)
    // a polygon inside a circle loses a little area; within 2% here
    expect(area(simple)).toBeGreaterThan(area(circle) * 0.98)
  })
})

describe('pathData', () => {
  const triangle: Point[] = [
    [0, 0],
    [10, 0],
    [5, 8],
  ]

  it('starts at the first point, has one curve per point, and closes', () => {
    const d = pathData(triangle)
    expect(d.startsWith('M0 0C')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(3)
  })

  it('passes through every point and returns to the first', () => {
    const d = pathData(triangle)
    // the last pair of numbers in each curve is where it ends
    const ends = d
      .slice(0, -1)
      .split('C')
      .slice(1)
      .map((curve) => curve.split(' ').slice(-2).map(Number))
    expect(ends).toEqual([
      [10, 0],
      [5, 8],
      [0, 0],
    ])
  })

  it('writes at most two decimals', () => {
    const d = pathData([
      [1.23456, 2.34567],
      [3.45678, 4.56789],
      [5.67891, 1.11111],
    ])
    expect(/\d\.\d{3}/.test(d)).toBe(false)
  })
})
