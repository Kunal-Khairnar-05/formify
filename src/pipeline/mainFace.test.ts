import { describe, expect, it } from 'vitest'
import { pickMainFace } from './mainFace'

const box = (width: number, height: number) => ({ x: 0, y: 0, width, height })

describe('pickMainFace', () => {
  it('returns null when there is no face', () => {
    expect(pickMainFace([])).toBeNull()
  })

  it('returns the only face', () => {
    expect(pickMainFace([box(100, 120)])).toBe(0)
  })

  it('picks the face that is clearly the largest, wherever it is in the list', () => {
    expect(pickMainFace([box(400, 500), box(120, 150)])).toBe(0)
    expect(pickMainFace([box(120, 150), box(400, 500)])).toBe(1)
    expect(pickMainFace([box(90, 100), box(400, 500), box(120, 150)])).toBe(1)
  })

  it('refuses when two faces are of similar size', () => {
    expect(pickMainFace([box(400, 500), box(380, 480)])).toBeNull()
    expect(pickMainFace([box(400, 500), box(400, 500)])).toBeNull()
  })

  it('needs the main face to have at least twice the area of each other face', () => {
    // 100 x 100 against 70 x 70: 10000 to 4900, just over twice
    expect(pickMainFace([box(100, 100), box(70, 70)])).toBe(0)
    // against 72 x 72: 10000 to 5184, under twice
    expect(pickMainFace([box(100, 100), box(72, 72)])).toBeNull()
  })

  it('refuses when a third face is too close in size, even if a second is small', () => {
    expect(pickMainFace([box(400, 500), box(50, 60), box(390, 480)])).toBeNull()
  })
})
