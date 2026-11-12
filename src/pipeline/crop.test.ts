import { describe, expect, it } from 'vitest'
import { cropBox } from './crop'
import type { FaceGeometry } from './types'

// a head 400 px tall (crown y=300, chin y=700), eyes centred on x
function faceAt(centreX: number, crownY = 300, headHeight = 400): FaceGeometry {
  return {
    box: { x: centreX - 150, y: crownY + 80, width: 300, height: headHeight - 80 },
    leftEye: { x: centreX - 60, y: crownY + 180 },
    rightEye: { x: centreX + 60, y: crownY + 180 },
    chin: { x: centreX, y: crownY + headHeight },
    crown: { x: centreX, y: crownY },
  }
}

const RATIO = 413 / 531

// within a pixel: the box is rounded to whole pixels
function expectTopMargin(crownY: number, box: { y: number; height: number }) {
  expect(Math.abs(crownY - box.y - 0.1 * box.height)).toBeLessThanOrEqual(1)
}

describe('cropBox', () => {
  it('sizes the crop so the head fills 65% of its height', () => {
    const box = cropBox(faceAt(1000), 2000, 2000, RATIO)
    expect(box.height).toBe(615) // 400 / 0.65 = 615.38
    expect(box.width / box.height).toBeCloseTo(RATIO, 2)
  })

  it('centres the crop on the midpoint of the eyes', () => {
    const box = cropBox(faceAt(1000), 2000, 2000, RATIO)
    expect(box.x + box.width / 2).toBeCloseTo(1000, 0)
  })

  it('leaves 10% of the crop height above the crown', () => {
    const box = cropBox(faceAt(1000), 2000, 2000, RATIO)
    expectTopMargin(300, box)
  })

  it('extends above the image when the head is near the top, keeping full size and margin', () => {
    const box = cropBox(faceAt(1000, 20), 2000, 2000, RATIO)
    expect(box.y).toBeLessThan(0)
    expect(box.height).toBe(615)
    expectTopMargin(20, box)
  })

  it('never extends below the image: shrinks instead, keeping the margin and the ratio', () => {
    // ideal height 769, but only 650 px exist below the crown
    const box = cropBox(faceAt(300, 50, 500), 600, 700, RATIO)
    expect(box.y + box.height).toBeLessThanOrEqual(700)
    expect(box.height).toBe(722) // 650 / 0.9
    expectTopMargin(50, box)
    expect(box.width / box.height).toBeCloseTo(RATIO, 2)
  })

  it('slides sideways to stay inside when the crop fits the width', () => {
    const left = cropBox(faceAt(100), 2000, 2000, RATIO)
    expect(left.x).toBe(0)
    const right = cropBox(faceAt(1950), 2000, 2000, RATIO)
    expect(right.x + right.width).toBeLessThanOrEqual(2000)
  })

  it('stays centred and extends past both sides when the crop is wider than the photo', () => {
    const box = cropBox(faceAt(200), 400, 2000, RATIO) // 478 px wide, photo is 400
    expect(box.x).toBeLessThan(0)
    expect(box.x + box.width).toBeGreaterThan(400)
    expect(box.x + box.width / 2).toBeCloseTo(200, 0)
  })

  it('holds its rules for any face position', () => {
    for (const centreX of [0, 137, 999.5, 1999]) {
      for (const crownY of [0, 250.3, 1500]) {
        const box = cropBox(faceAt(centreX, crownY), 2000, 2000, RATIO)
        expect(box.y + box.height).toBeLessThanOrEqual(2000)
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(2000)
        expect(box.width / box.height).toBeCloseTo(RATIO, 2)
      }
    }
  })
})
