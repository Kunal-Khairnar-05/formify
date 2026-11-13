import { describe, expect, it } from 'vitest'
import {
  dragRegion,
  fitRegion,
  fractionAspect,
  FULL,
  isFull,
  regionToPixels,
  type Region,
} from './region'

const middle: Region = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }

const close = (actual: Region, expected: Region) => {
  expect(actual.x).toBeCloseTo(expected.x)
  expect(actual.y).toBeCloseTo(expected.y)
  expect(actual.width).toBeCloseTo(expected.width)
  expect(actual.height).toBeCloseTo(expected.height)
}

describe('dragRegion', () => {
  it('moves the whole region without resizing it', () => {
    close(dragRegion(middle, 'move', 0.1, -0.1), { x: 0.35, y: 0.15, width: 0.5, height: 0.5 })
  })

  it('stops a move at the edges of the photo', () => {
    close(dragRegion(middle, 'move', 5, 5), { x: 0.5, y: 0.5, width: 0.5, height: 0.5 })
    close(dragRegion(middle, 'move', -5, -5), { x: 0, y: 0, width: 0.5, height: 0.5 })
  })

  it('cannot move a region that covers the whole photo', () => {
    close(dragRegion(FULL, 'move', 0.3, 0.3), FULL)
  })

  it('resizes from each corner, keeping the opposite corner fixed', () => {
    close(dragRegion(middle, 'nw', 0.1, 0.1), { x: 0.35, y: 0.35, width: 0.4, height: 0.4 })
    close(dragRegion(middle, 'ne', 0.1, 0.1), { x: 0.25, y: 0.35, width: 0.6, height: 0.4 })
    close(dragRegion(middle, 'sw', 0.1, 0.1), { x: 0.35, y: 0.25, width: 0.4, height: 0.6 })
    close(dragRegion(middle, 'se', 0.1, 0.1), { x: 0.25, y: 0.25, width: 0.6, height: 0.6 })
  })

  it('stops a resize at the edges of the photo', () => {
    close(dragRegion(middle, 'se', 5, 5), { x: 0.25, y: 0.25, width: 0.75, height: 0.75 })
    close(dragRegion(middle, 'nw', -5, -5), { x: 0, y: 0, width: 0.75, height: 0.75 })
  })

  it('never shrinks below the minimum size or flips over', () => {
    close(dragRegion(middle, 'se', -5, -5), { x: 0.25, y: 0.25, width: 0.1, height: 0.1 })
    close(dragRegion(middle, 'nw', 5, 5), { x: 0.65, y: 0.65, width: 0.1, height: 0.1 })
  })

  it('can crop in from the full photo', () => {
    close(dragRegion(FULL, 'nw', 0.2, 0.1), { x: 0.2, y: 0.1, width: 0.8, height: 0.9 })
  })
})

describe('fractionAspect', () => {
  it('is 1 when the photo already has the output shape', () => {
    expect(fractionAspect(3 / 4, 1500, 2000)).toBeCloseTo(1)
  })

  it('is below 1 when the photo is wider than the output', () => {
    expect(fractionAspect(3 / 4, 2000, 1500)).toBeCloseTo(0.5625)
  })

  it('is above 1 when the photo is taller than the output', () => {
    expect(fractionAspect(1, 1000, 2000)).toBeCloseTo(2)
  })
})

describe('fitRegion', () => {
  it('covers the whole photo when the shapes match', () => {
    close(fitRegion(1), FULL)
  })

  it('uses the full height of a wider photo, centred', () => {
    close(fitRegion(0.5), { x: 0.25, y: 0, width: 0.5, height: 1 })
  })

  it('uses the full width of a taller photo, centred', () => {
    close(fitRegion(2), { x: 0, y: 0.25, width: 1, height: 0.5 })
  })
})

describe('dragRegion with a locked shape', () => {
  // a 3:4 output on a 4:3 photo
  const aspect = fractionAspect(3 / 4, 2000, 1500)
  const start = { x: 0.3, y: 0.2, width: 0.4 * aspect, height: 0.4 }
  const shape = (region: Region) => region.width / region.height

  it('keeps the shape from every corner, for any drag', () => {
    for (const handle of ['nw', 'ne', 'sw', 'se'] as const) {
      for (const [dx, dy] of [
        [0.1, 0.1],
        [-0.1, 0.05],
        [0.3, -0.2],
        [5, 5],
        [-5, -5],
        [0, 0],
      ]) {
        const region = dragRegion(start, handle, dx, dy, aspect)
        expect(shape(region)).toBeCloseTo(aspect)
        expect(region.x).toBeGreaterThanOrEqual(-1e-9)
        expect(region.y).toBeGreaterThanOrEqual(-1e-9)
        expect(region.x + region.width).toBeLessThanOrEqual(1 + 1e-9)
        expect(region.y + region.height).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('keeps the opposite corner fixed', () => {
    const se = dragRegion(start, 'se', 0.1, 0.1, aspect)
    expect(se.x).toBeCloseTo(start.x)
    expect(se.y).toBeCloseTo(start.y)

    const nw = dragRegion(start, 'nw', -0.1, -0.1, aspect)
    expect(nw.x + nw.width).toBeCloseTo(start.x + start.width)
    expect(nw.y + nw.height).toBeCloseTo(start.y + start.height)
  })

  it('does not change with no movement', () => {
    close(dragRegion(start, 'se', 0, 0, aspect), start)
  })

  it('grows when dragged outward in either direction', () => {
    expect(dragRegion(start, 'se', 0.1, 0, aspect).width).toBeGreaterThan(start.width)
    expect(dragRegion(start, 'se', 0, 0.1, aspect).height).toBeGreaterThan(start.height)
  })

  it('stops at the edge of the photo without changing shape', () => {
    const region = dragRegion(start, 'se', 5, 5, aspect)
    expect(region.y + region.height).toBeCloseTo(1)
    expect(shape(region)).toBeCloseTo(aspect)
  })

  it('keeps both sides at or above the minimum size', () => {
    const region = dragRegion(start, 'se', -5, -5, aspect)
    expect(region.width).toBeGreaterThanOrEqual(0.1 - 1e-9)
    expect(region.height).toBeGreaterThanOrEqual(0.1 - 1e-9)
  })

  it('still moves without resizing', () => {
    const moved = dragRegion(start, 'move', 0.1, 0.1, aspect)
    expect(moved.width).toBeCloseTo(start.width)
    expect(moved.height).toBeCloseTo(start.height)
  })
})

describe('isFull', () => {
  it('is true only for the whole photo', () => {
    expect(isFull(FULL)).toBe(true)
    expect(isFull({ ...FULL })).toBe(true)
    expect(isFull(middle)).toBe(false)
    expect(isFull({ x: 0, y: 0, width: 1, height: 0.99 })).toBe(false)
  })
})

describe('regionToPixels', () => {
  it('scales fractions to pixels', () => {
    expect(regionToPixels(middle, 4000, 3000)).toEqual({ x: 1000, y: 750, width: 2000, height: 1500 })
    expect(regionToPixels(FULL, 4000, 3000)).toEqual({ x: 0, y: 0, width: 4000, height: 3000 })
  })

  it('stays inside the photo after rounding', () => {
    const rect = regionToPixels({ x: 0.666, y: 0.666, width: 0.334, height: 0.334 }, 10, 10)
    expect(rect.x + rect.width).toBeLessThanOrEqual(10)
    expect(rect.y + rect.height).toBeLessThanOrEqual(10)
  })

  it('is never empty', () => {
    const rect = regionToPixels({ x: 0.99, y: 0.99, width: 0.001, height: 0.001 }, 5, 5)
    expect(rect.width).toBeGreaterThanOrEqual(1)
    expect(rect.height).toBeGreaterThanOrEqual(1)
    expect(rect.x + rect.width).toBeLessThanOrEqual(5)
  })
})
