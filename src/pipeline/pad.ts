// a segment's 2-byte length counts itself, so the most it can hold is 65535 - 2
const MAX_PAYLOAD = 65533
// marker (2 bytes) + length (2 bytes): what a segment costs before it holds anything
const OVERHEAD = 4

/**
 * Grow a JPEG to at least `size` bytes by adding comment segments, which every
 * decoder skips. The picture itself is not touched.
 */
export function padJpeg(bytes: Uint8Array, size: number): Uint8Array {
  let extra = size - bytes.length
  if (extra <= 0) return bytes
  // nothing smaller than an empty segment can be added
  if (extra < OVERHEAD) extra = OVERHEAD

  // insert after the start marker (2 bytes) and, when present, the JFIF header,
  // which has to come first in the file
  let at = 2
  if (bytes[2] === 0xff && bytes[3] === 0xe0) {
    at += 2 + ((bytes[4] << 8) | bytes[5])
  }

  const out = new Uint8Array(bytes.length + extra)
  out.set(bytes.subarray(0, at))

  let pos = at
  while (extra > 0) {
    let payload = Math.min(extra - OVERHEAD, MAX_PAYLOAD)
    // never leave 1 to 3 bytes over: that is too few for another segment
    const left = extra - OVERHEAD - payload
    if (left > 0 && left < OVERHEAD) payload -= OVERHEAD

    const length = payload + 2
    out[pos] = 0xff
    out[pos + 1] = 0xfe // COM: comment
    out[pos + 2] = length >> 8
    out[pos + 3] = length & 0xff
    // the payload stays zero

    pos += OVERHEAD + payload
    extra -= OVERHEAD + payload
  }

  out.set(bytes.subarray(at), pos)
  return out
}