import { describe, expect, it } from 'vitest'
import { sourceWarnings, type FaceMeasures } from './sourceWarnings'

// a face that is level, evenly and well lit, and sharp
const good: FaceMeasures = { tilt: 1, brightness: 0.55, balance: 0.02, sharpness: 0.03 }
const warn = (change: Partial<FaceMeasures>) => sourceWarnings({ ...good, ...change })

describe('sourceWarnings', () => {
  it('says nothing about a good photo', () => {
    expect(sourceWarnings(good)).toEqual([])
  })

  it('warns about a leaning head, in either direction, with the angle', () => {
    expect(warn({ tilt: 12.4 })).toEqual([expect.stringContaining('leans about 12 degrees')])
    expect(warn({ tilt: -12.4 })).toEqual([expect.stringContaining('leans about 12 degrees')])
  })

  it('allows a slight lean', () => {
    expect(warn({ tilt: 5 })).toEqual([])
    expect(warn({ tilt: -5 })).toEqual([])
  })

  it('warns about a dark face', () => {
    expect(warn({ brightness: 0.15 })).toEqual([expect.stringContaining('dark')])
  })

  it('warns about a washed-out face', () => {
    expect(warn({ brightness: 0.95 })).toEqual([expect.stringContaining('bright')])
  })

  it('names the side that is in shadow', () => {
    // positive balance: the left half is brighter, so the right is in shadow
    expect(warn({ balance: 0.5 })).toEqual([expect.stringContaining('right side')])
    expect(warn({ balance: -0.5 })).toEqual([expect.stringContaining('left side')])
  })

  it('warns about a blurred face', () => {
    expect(warn({ sharpness: 0 })).toEqual([expect.stringContaining('blurred')])
  })

  it('gives every warning that applies', () => {
    expect(warn({ tilt: 20, brightness: 0.1, balance: 0.5, sharpness: 0 })).toHaveLength(4)
  })
})
