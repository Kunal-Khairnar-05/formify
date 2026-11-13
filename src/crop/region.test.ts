import { describe, expect, it } from 'vitest'
import { dragRegion, FULL, isFull, regionToPixels, type Region } from './region'

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
