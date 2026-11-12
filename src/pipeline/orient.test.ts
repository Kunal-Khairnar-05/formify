import { describe, expect, it } from 'vitest'
import { quarterTurns } from './orient'
import type { FaceGeometry } from './types'

// a face whose eye line points at `degrees` (0 = upright, measured clockwise on screen)
function faceWithEyeAngle(degrees: number): FaceGeometry {
  const radians = (degrees * Math.PI) / 180
  const left = { x: 500, y: 500 }
  const right = { x: 500 + 100 * Math.cos(radians), y: 500 + 100 * Math.sin(radians) }
  return {
    box: { x: 400, y: 400, width: 300, height: 300 },
    leftEye: left,
    rightEye: right,
    chin: { x: 550, y: 700 },
    crown: { x: 550, y: 300 },
  }
}

describe('quarterTurns', () => {
  it('leaves an upright face alone', () => {
    expect(quarterTurns(faceWithEyeAngle(0))).toBe(0)
  })

  it('ignores a small tilt of the head', () => {
    expect(quarterTurns(faceWithEyeAngle(-12))).toBe(0)
    expect(quarterTurns(faceWithEyeAngle(20))).toBe(0)
  })

  it('turns a photo rotated 90 degrees clockwise back with 3 clockwise turns', () => {
    expect(quarterTurns(faceWithEyeAngle(88))).toBe(3)
  })

  it('turns a photo rotated 90 degrees counter-clockwise back with 1 clockwise turn', () => {
    expect(quarterTurns(faceWithEyeAngle(-91))).toBe(1)
  })

  it('turns an upside-down face with 2 turns, from either side of 180 degrees', () => {
    expect(quarterTurns(faceWithEyeAngle(178))).toBe(2)
    expect(quarterTurns(faceWithEyeAngle(-178))).toBe(2)
  })
})
