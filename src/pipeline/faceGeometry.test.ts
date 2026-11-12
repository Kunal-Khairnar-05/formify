import { describe, expect, it } from 'vitest'
import { faceGeometry } from './faceGeometry'

// 478 points at the image centre, then the ones the function reads moved to known places
function landmarks(overrides: Record<number, { x: number; y: number }>) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
  for (const [index, point] of Object.entries(overrides)) points[Number(index)] = point
  return points
}

describe('faceGeometry', () => {
  const upright = landmarks({
    10: { x: 0.5, y: 0.3 },
    152: { x: 0.5, y: 0.7 },
    33: { x: 0.38, y: 0.45 },
    133: { x: 0.46, y: 0.45 },
    263: { x: 0.62, y: 0.45 },
    362: { x: 0.54, y: 0.45 },
  })

  it('converts normalised landmarks to image pixels', () => {
    const face = faceGeometry(upright, 1000, 2000)
    expect(face.chin).toEqual({ x: 500, y: 1400 })
    expect(face.leftEye.x).toBeCloseTo(420)
    expect(face.rightEye.x).toBeCloseTo(580)
    expect(face.leftEye.y).toBeCloseTo(900)
  })

  it('bounds every landmark with the box', () => {
    const face = faceGeometry(upright, 1000, 2000)
    expect(face.box.x).toBeCloseTo(380)
    expect(face.box.y).toBeCloseTo(600)
    expect(face.box.width).toBeCloseTo(240)
    expect(face.box.height).toBeCloseTo(800)
  })

  it('places the crown above the forehead on the chin-to-forehead line', () => {
    const face = faceGeometry(upright, 1000, 2000)
    // forehead at y=600, chin at y=1400: 30% of 800 px further up
    expect(face.crown.x).toBeCloseTo(500)
    expect(face.crown.y).toBeCloseTo(360)
  })

  it('leans the crown the same way as a tilted head', () => {
    const tilted = landmarks({ 10: { x: 0.6, y: 0.3 }, 152: { x: 0.5, y: 0.7 } })
    const face = faceGeometry(tilted, 1000, 1000)
    expect(face.crown.x).toBeGreaterThan(600)
    expect(face.crown.y).toBeLessThan(300)
  })
})
