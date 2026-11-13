import { describe, expect, it } from 'vitest'
import { padJpeg } from './pad'
import { measure } from './validate'

const SOI = [0xff, 0xd8]
// JFIF header: marker, length 16, then 14 bytes of payload
const APP0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]
// baseline frame header for a 413 x 531 px image: marker, length 11, precision, height, width, ...
const SOF0 = [0xff, 0xc0, 0x00, 0x0b, 8, 0x02, 0x13, 0x01, 0x9d, 1, 1, 0x11, 0]
const EOI = [0xff, 0xd9]

const withHeader = new Uint8Array([...SOI, ...APP0, ...SOF0, ...EOI])
const withoutHeader = new Uint8Array([...SOI, ...SOF0, ...EOI])

/** Walk the segments after SOI and return each one's marker and total size, up to the frame header. */
function segments(bytes: Uint8Array): { marker: number; size: number; offset: number }[] {
  const found = []
  let offset = 2
  while (offset < bytes.length) {
    expect(bytes[offset]).toBe(0xff)
    const marker = bytes[offset + 1]
    const size = 2 + ((bytes[offset + 2] << 8) | bytes[offset + 3])
    found.push({ marker, size, offset })
    if (marker === 0xc0) break
    offset += size
  }
  return found
}

/** The file with every comment segment taken out again. */
function withoutComments(bytes: Uint8Array): number[] {
  const out = [...bytes.subarray(0, 2)]
  for (const { marker, size, offset } of segments(bytes)) {
    if (marker === 0xc0) out.push(...bytes.subarray(offset))
    else if (marker !== 0xfe) out.push(...bytes.subarray(offset, offset + size))
  }
  return out
}

describe('padJpeg', () => {
  it('returns the same bytes when the file is already large enough', () => {
    expect(padJpeg(withHeader, withHeader.length)).toBe(withHeader)
    expect(padJpeg(withHeader, 10)).toBe(withHeader)
  })

  it('reaches the asked size exactly', () => {
    for (const extra of [4, 5, 100, 2_000, 65_537, 65_538, 65_540, 65_541, 70_000, 200_000]) {
      const size = withHeader.length + extra
      expect(padJpeg(withHeader, size).length).toBe(size)
    }
  })

  it('adds a whole 4-byte segment when fewer than 4 bytes are missing', () => {
    for (const extra of [1, 2, 3]) {
      expect(padJpeg(withHeader, withHeader.length + extra).length).toBe(withHeader.length + 4)
    }
  })

  it('puts the padding after the JFIF header, which must stay first', () => {
    const [first, second] = segments(padJpeg(withHeader, 1_000))
    expect(first.marker).toBe(0xe0)
    expect(second.marker).toBe(0xfe)
  })

  it('puts the padding straight after the start marker when there is no JFIF header', () => {
    const [first] = segments(padJpeg(withoutHeader, 1_000))
    expect(first.marker).toBe(0xfe)
  })

  it('writes only well-formed segments, none larger than a segment can be', () => {
    for (const extra of [4, 7, 65_537, 65_541, 70_000, 200_000]) {
      const padded = padJpeg(withHeader, withHeader.length + extra)
      const found = segments(padded)
      // the walk reached the frame header, so every length along the way was right
      expect(found.at(-1)!.marker).toBe(0xc0)
      for (const { marker, size } of found) {
        if (marker === 0xfe) expect(size).toBeLessThanOrEqual(65_537)
      }
    }
  })

  it('leaves the rest of the file untouched', () => {
    for (const source of [withHeader, withoutHeader]) {
      for (const extra of [4, 1_000, 70_000]) {
        const padded = padJpeg(source, source.length + extra)
        expect(withoutComments(padded)).toEqual([...source])
      }
    }
  })

  it('does not change what the file measures as', () => {
    const padded = padJpeg(withHeader, 30_000)
    expect(measure(padded)).toEqual({ widthPx: 413, heightPx: 531, bytes: 30_000, format: 'jpg' })
  })

  it('does not modify its input', () => {
    const copy = new Uint8Array(withHeader)
    padJpeg(withHeader, 5_000)
    expect(withHeader).toEqual(copy)
  })
})
