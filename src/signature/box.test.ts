import { describe, expect, it } from 'vitest'
import { signatureBox } from './box'

describe('signatureBox', () => {
  it('adds the margin on every side', () => {
    // ink 200 x 100 at the output's own shape: margin 10% of 200 = 20 px a side
    expect(signatureBox({ x: 100, y: 100, width: 200, height: 100 }, 240 / 140, 0.1)).toEqual({
      x: 80,
      y: 80,
      width: 240,
      height: 140,
    })
  })

  it('grows in height for a wide, flat signature', () => {
    const box = signatureBox({ x: 0, y: 500, width: 400, height: 40 }, 2, 0)
    expect(box).toEqual({ x: 0, y: 420, width: 400, height: 200 })
  })

  it('grows in width for a tall, narrow signature', () => {
    const box = signatureBox({ x: 500, y: 0, width: 50, height: 100 }, 2, 0)
    expect(box).toEqual({ x: 425, y: 0, width: 200, height: 100 })
  })

  it('keeps the ink in the centre and inside the box', () => {
    for (const aspect of [140 / 60, 1, 0.5, 3.5 / 1.5]) {
      const ink = { x: 300, y: 200, width: 180, height: 75 }
      const box = signatureBox(ink, aspect, 0.08)
      expect(box.width / box.height).toBeCloseTo(aspect, 1)
      expect(box.x).toBeLessThanOrEqual(ink.x)
      expect(box.y).toBeLessThanOrEqual(ink.y)
      expect(box.x + box.width).toBeGreaterThanOrEqual(ink.x + ink.width)
      expect(box.y + box.height).toBeGreaterThanOrEqual(ink.y + ink.height)
      // within a pixel: the box is rounded to whole pixels
      expect(Math.abs(box.x + box.width / 2 - (ink.x + ink.width / 2))).toBeLessThanOrEqual(1)
      expect(Math.abs(box.y + box.height / 2 - (ink.y + ink.height / 2))).toBeLessThanOrEqual(1)
    }
  })

  it('may reach outside the image', () => {
    expect(signatureBox({ x: 0, y: 0, width: 100, height: 100 }, 2, 0.1).x).toBeLessThan(0)
  })
})
