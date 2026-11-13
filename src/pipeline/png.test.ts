import { describe, expect, it } from 'vitest'
import { crc32, isPng, padPng, PNG_SIGNATURE } from './png'
import { measure } from './validate'

const ascii = (text: string) => [...text].map((ch) => ch.charCodeAt(0))
const uint32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]

/** One chunk: length, type, data, CRC of type and data. */
function chunk(type: string, data: number[]): number[] {
  const body = new Uint8Array([...ascii(type), ...data])
  return [...uint32(data.length), ...body, ...uint32(crc32(body))]
}

/** The smallest thing shaped like a PNG: signature, IHDR, an image-data chunk, IEND. */
function png(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...chunk('IHDR', [...uint32(width), ...uint32(height), 8, 2, 0, 0, 0]),
    ...chunk('IDAT', [1, 2, 3, 4, 5]),
    ...chunk('IEND', []),
  ])
}

/** Walk the chunks, checking each CRC; returns the chunk names in order. */
function chunkNames(bytes: Uint8Array): string[] {
  const names: string[] = []
  let at = 8
  while (at < bytes.length) {
    const length = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
    const end = at + 8 + length
    const stored = ((bytes[end] << 24) | (bytes[end + 1] << 16) | (bytes[end + 2] << 8) | bytes[end + 3]) >>> 0
    expect(stored).toBe(crc32(bytes, at + 4, end))
    names.push(String.fromCharCode(...bytes.subarray(at + 4, at + 8)))
    at = end + 4
  }
  expect(at).toBe(bytes.length)
  return names
}

describe('crc32', () => {
  it('matches the published check value', () => {
    // the standard test for CRC-32: the ASCII digits 1 to 9
    expect(crc32(new Uint8Array(ascii('123456789')))).toBe(0xcbf43926)
  })

  it('gives the well-known CRC of an empty IEND chunk', () => {
    expect(crc32(new Uint8Array(ascii('IEND')))).toBe(0xae426082)
  })

  it('can check part of an array', () => {
    const bytes = new Uint8Array(ascii('xx123456789yy'))
    expect(crc32(bytes, 2, 11)).toBe(0xcbf43926)
  })
})

describe('isPng', () => {
  it('knows a PNG by its first eight bytes', () => {
    expect(isPng(png(4, 4))).toBe(true)
  })

  it('refuses a JPEG, an empty file and a short one', () => {
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(false)
    expect(isPng(new Uint8Array(0))).toBe(false)
    expect(isPng(new Uint8Array(PNG_SIGNATURE.slice(0, 7)))).toBe(false)
  })
})

describe('measure, for a PNG', () => {
  it('reads the width and height from the IHDR chunk', () => {
    const bytes = png(413, 531)
    expect(measure(bytes)).toEqual({ widthPx: 413, heightPx: 531, bytes: bytes.length, format: 'png' })
  })

  it('reads sizes that need more than one byte each', () => {
    expect(measure(png(4000, 3000))).toMatchObject({ widthPx: 4000, heightPx: 3000 })
  })
})

describe('padPng', () => {
  it('grows the file to exactly the size asked for', () => {
    expect(padPng(png(4, 4), 500)).toHaveLength(500)
    expect(padPng(png(4, 4), 70_000)).toHaveLength(70_000)
  })

  it('adds one chunk before IEND, with a correct CRC, and leaves the rest as it was', () => {
    const original = png(4, 4)
    const padded = padPng(original, 300)
    expect(chunkNames(padded)).toEqual(['IHDR', 'IDAT', 'fpPd', 'IEND'])
    // everything before the new chunk, and the IEND after it, is unchanged
    expect([...padded.subarray(0, original.length - 12)]).toEqual([...original.subarray(0, original.length - 12)])
    expect([...padded.subarray(padded.length - 12)]).toEqual([...original.subarray(original.length - 12)])
  })

  it('still measures as the same picture', () => {
    expect(measure(padPng(png(140, 60), 12_000))).toMatchObject({ widthPx: 140, heightPx: 60, format: 'png' })
  })

  it('returns the input when it is already large enough', () => {
    const original = png(4, 4)
    expect(padPng(original, original.length)).toBe(original)
    expect(padPng(original, 10)).toBe(original)
  })

  it('adds a whole chunk when only a few bytes are missing, going slightly over', () => {
    const original = png(4, 4)
    const padded = padPng(original, original.length + 5)
    // a chunk is at least 12 bytes
    expect(padded).toHaveLength(original.length + 12)
    expect(chunkNames(padded)).toContain('fpPd')
  })

  it('does not touch a file that is not a PNG', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    expect(padPng(jpeg, 100)).toBe(jpeg)
  })

  it('does not modify its input', () => {
    const original = png(4, 4)
    const copy = [...original]
    padPng(original, 200)
    expect([...original]).toEqual(copy)
  })
})
