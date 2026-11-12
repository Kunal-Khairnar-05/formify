import { describe, expect, it } from 'vitest'
import type { Spec } from './types'
import { measure, validate } from './validate'

/** Smallest byte sequence with a real JPEG layout: SOI, APP0, SOF0, padding, EOI. */
function fakeJpeg(width: number, height: number, totalBytes: number, sofMarker = 0xc0): Uint8Array {
  const header = [
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0), // APP0, length 16
    0xff, sofMarker, 0x00, 0x11, 0x08, // SOF, length 17, 8-bit
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    ...new Array(10).fill(0),
  ]
  const bytes = new Uint8Array(totalBytes)
  bytes.set(header)
  bytes.set([0xff, 0xd9], totalBytes - 2) // EOI
  return bytes
}

const spec: Spec = { widthPx: 413, heightPx: 531, minKb: 20, maxKb: 50, format: 'jpg', background: '#ffffff' }

describe('measure', () => {
  it('reads width and height from the frame header, not from any setting', () => {
    expect(measure(fakeJpeg(413, 531, 30_000))).toEqual({
      widthPx: 413,
      heightPx: 531,
      bytes: 30_000,
      format: 'jpg',
    })
  })

  it('handles sizes above 255 px in both bytes of each dimension', () => {
    const m = measure(fakeJpeg(4000, 3000, 1000))
    expect([m.widthPx, m.heightPx]).toEqual([4000, 3000])
  })

  it('reads progressive files too (SOF2)', () => {
    const m = measure(fakeJpeg(600, 800, 1000, 0xc2))
    expect([m.widthPx, m.heightPx]).toEqual([600, 800])
  })

  it('reports unknown for bytes that are not a JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(measure(png).format).toBe('unknown')
  })

  it('reports unknown for a truncated file instead of throwing', () => {
    expect(measure(new Uint8Array([0xff, 0xd8, 0xff])).format).toBe('unknown')
    expect(measure(new Uint8Array(0)).format).toBe('unknown')
  })
})

describe('validate', () => {
  it('passes a file that matches the spec', () => {
    expect(validate(fakeJpeg(413, 531, 30_000), spec)).toEqual([])
  })

  it('reports wrong dimensions', () => {
    const problems = validate(fakeJpeg(400, 531, 30_000), spec)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('413')
  })

  it('counts the maximum in 1000-byte KB, the stricter reading', () => {
    expect(validate(fakeJpeg(413, 531, 50_000), spec)).toEqual([])
    expect(validate(fakeJpeg(413, 531, 50_001), spec)).toHaveLength(1)
  })

  it('counts the minimum in 1024-byte KB, the stricter reading', () => {
    expect(validate(fakeJpeg(413, 531, 20 * 1024), spec)).toEqual([])
    expect(validate(fakeJpeg(413, 531, 20 * 1024 - 1), spec)).toHaveLength(1)
  })

  it('skips size checks the spec does not ask for', () => {
    const open: Spec = { ...spec, minKb: undefined, maxKb: undefined }
    expect(validate(fakeJpeg(413, 531, 900_000), open)).toEqual([])
  })

  it('reports every problem at once', () => {
    expect(validate(fakeJpeg(100, 100, 90_000), spec).length).toBeGreaterThanOrEqual(2)
  })

  it('rejects a file that is not a JPEG', () => {
    expect(validate(new Uint8Array(30_000), spec).length).toBeGreaterThanOrEqual(1)
  })
})
