import { isPng } from './png'
import type { Measurement, Spec } from './types'

const UNKNOWN: Omit<Measurement, 'bytes'> = { widthPx: 0, heightPx: 0, format: 'unknown' }

// Start Of Frame markers carry the image size. C4, C8 and CC are in the same
// range but mean something else.
function isFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

/** Step 7c: read width, height and size back from the encoded bytes. */
export function measure(bytes: Uint8Array): Measurement {
  // a PNG starts with its signature, then the IHDR chunk: 4 bytes of length, "IHDR",
  // then the width and the height as 4 bytes each, most significant byte first
  if (isPng(bytes) && bytes.length >= 24) {
    const uint32 = (at: number) =>
      ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
    return { widthPx: uint32(16), heightPx: uint32(20), bytes: bytes.length, format: 'png' }
  }

  // every JPEG starts with the SOI marker FF D8
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { ...UNKNOWN, bytes: bytes.length }
  }

  // walk the segments: FF, marker, 2-byte length, payload
  let offset = 2
  while (offset + 9 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    if (isFrameMarker(marker)) {
      return {
        heightPx: (bytes[offset + 5] << 8) | bytes[offset + 6],
        widthPx: (bytes[offset + 7] << 8) | bytes[offset + 8],
        bytes: bytes.length,
        format: 'jpg',
      }
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    offset += 2 + length
  }
  return { ...UNKNOWN, bytes: bytes.length }
}

/** Step 7c: list every way the file breaks the spec; empty means it passes. */
export function validate(bytes: Uint8Array, spec: Spec): string[] {
  const actual = measure(bytes)
  const problems: string[] = []

  if (actual.format !== spec.format) {
    problems.push(`Format is ${actual.format}, expected ${spec.format}`)
  }
  if (actual.widthPx !== spec.widthPx || actual.heightPx !== spec.heightPx) {
    problems.push(
      `Size is ${actual.widthPx} x ${actual.heightPx} px, expected ${spec.widthPx} x ${spec.heightPx} px`,
    )
  }
  // portals disagree on 1 KB = 1000 or 1024 bytes, so each limit uses the stricter reading
  if (spec.maxKb !== undefined && actual.bytes > spec.maxKb * 1000) {
    problems.push(`File is ${actual.bytes} bytes, above the ${spec.maxKb} KB maximum`)
  }
  if (spec.minKb !== undefined && actual.bytes < spec.minKb * 1024) {
    problems.push(`File is ${actual.bytes} bytes, below the ${spec.minKb} KB minimum`)
  }
  return problems
}