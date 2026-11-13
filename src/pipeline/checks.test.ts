import { describe, expect, it } from 'vitest'
import { brightness, headTilt, sharpness, sideBalance } from './checks'

const eyes = (lx: number, ly: number, rx: number, ry: number) => ({
  leftEye: { x: lx, y: ly },
  rightEye: { x: rx, y: ry },
})

describe('headTilt', () => {
  it('is 0 when the eyes are level', () => {
    expect(headTilt(eyes(100, 200, 300, 200))).toBeCloseTo(0)
  })

  it('is positive when the right eye is lower: the head leans clockwise', () => {
    expect(headTilt(eyes(100, 200, 300, 400))).toBeCloseTo(45)
  })

  it('is negative when the right eye is higher', () => {
    expect(headTilt(eyes(100, 200, 300, 100))).toBeCloseTo(-26.57, 1)
  })

  it('does not depend on how far apart the eyes are', () => {
    expect(headTilt(eyes(0, 0, 10, 1))).toBeCloseTo(headTilt(eyes(0, 0, 1000, 100)))
  })
})

describe('brightness', () => {
  it('is the mean of the values', () => {
    expect(brightness(new Float32Array([0, 0.5, 1, 0.5]))).toBeCloseTo(0.5)
    expect(brightness(new Float32Array([0.2, 0.2]))).toBeCloseTo(0.2)
  })

  it('is 0 for an empty picture', () => {
    expect(brightness(new Float32Array(0))).toBe(0)
  })
})

describe('sideBalance', () => {
  it('is 0 when both halves are equally bright', () => {
    expect(sideBalance(new Float32Array([0.4, 0.6, 0.6, 0.4]), 4, 1)).toBeCloseTo(0)
  })

  it('is positive when the left half is brighter', () => {
    // 4 x 2: left two columns 0.8, right two columns 0.2
    const gray = new Float32Array([0.8, 0.8, 0.2, 0.2, 0.8, 0.8, 0.2, 0.2])
    expect(sideBalance(gray, 4, 2)).toBeCloseTo(0.6)
  })

  it('is negative when the right half is brighter', () => {
    expect(sideBalance(new Float32Array([0.1, 0.1, 0.5, 0.5]), 4, 1)).toBeCloseTo(-0.4)
  })

  it('leaves the middle column out when the width is odd', () => {
    expect(sideBalance(new Float32Array([0.9, 0, 0.3]), 3, 1)).toBeCloseTo(0.6)
  })
})

describe('sharpness', () => {
  const SIZE = 16
  const picture = (value: (x: number, y: number) => number) => {
    const gray = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) gray[y * SIZE + x] = value(x, y)
    return gray
  }

  it('is 0 for a flat picture', () => {
    expect(sharpness(picture(() => 0.5), SIZE, SIZE)).toBeCloseTo(0)
  })

  it('is 0 for a smooth ramp, which has no edges', () => {
    expect(sharpness(picture((x) => x / SIZE), SIZE, SIZE)).toBeCloseTo(0)
  })

  it('is higher for a hard edge than for a soft one', () => {
    const hard = picture((x) => (x < 8 ? 0 : 1))
    // the same step spread over six columns
    const soft = picture((x) => Math.min(1, Math.max(0, (x - 5) / 6)))
    expect(sharpness(hard, SIZE, SIZE)).toBeGreaterThan(sharpness(soft, SIZE, SIZE) * 4)
  })

  it('is higher for fine detail than for one edge', () => {
    const stripes = picture((x) => x % 2)
    const edge = picture((x) => (x < 8 ? 0 : 1))
    expect(sharpness(stripes, SIZE, SIZE)).toBeGreaterThan(sharpness(edge, SIZE, SIZE))
  })

  it('is 0 for a picture too small to have a neighbourhood', () => {
    expect(sharpness(new Float32Array([0, 1, 0, 1]), 2, 2)).toBe(0)
  })
})
