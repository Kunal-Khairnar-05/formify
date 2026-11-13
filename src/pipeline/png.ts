// A PNG file is an 8-byte signature followed by chunks. Each chunk is: 4 bytes of data
// length, 4 bytes of type, the data, and a 4-byte CRC of the type and data. The first chunk
// is IHDR (width, height, colour type) and the last is IEND.

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

// a chunk's length, type and CRC: the bytes it takes with no data in it
const CHUNK_OVERHEAD = 12
// IEND has no data, so the whole chunk is 12 bytes at the very end of the file
const IEND_LENGTH = 12
// The padding chunk's name. The case of each letter is a flag that readers act on:
// f lower = not needed to show the picture, p lower = private (not a standard chunk),
// P upper = required by the format, d lower = safe to copy when the picture is edited.
const PAD_TYPE = [0x66, 0x70, 0x50, 0x64] as const // "fpPd"

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && PNG_SIGNATURE.every((value, i) => bytes[i] === value)
}

/** Lossless PNG, made by the browser's own encoder. */
export async function encodePng(pixels: ImageData): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(pixels.width, pixels.height)
  canvas.getContext('2d')!.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}

// the CRC of every possible byte, worked out once; the standard table for CRC-32
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

/** CRC-32 of bytes[start..end), the checksum every PNG chunk ends with. */
export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffffffff
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const writeUint32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

/**
 * Grow a PNG to at least `size` bytes by adding one chunk of zeros just before IEND.
 * Readers skip a chunk they do not know when its name marks it as not needed, so the
 * picture is unchanged. Returns the input when it is already large enough or is not a PNG.
 */
export function padPng(bytes: Uint8Array, size: number): Uint8Array {
  if (!isPng(bytes) || bytes.length >= size) return bytes

  // a chunk cannot be smaller than its own overhead, so the result may pass `size` by a few bytes
  const dataLength = Math.max(0, size - bytes.length - CHUNK_OVERHEAD)
  const out = new Uint8Array(bytes.length + CHUNK_OVERHEAD + dataLength)
  const insertAt = bytes.length - IEND_LENGTH

  out.set(bytes.subarray(0, insertAt), 0)
  writeUint32(out, insertAt, dataLength)
  out.set(PAD_TYPE, insertAt + 4)
  // the data is left as zeros; the CRC covers the type and the data
  const dataEnd = insertAt + 8 + dataLength
  writeUint32(out, dataEnd, crc32(out, insertAt + 4, dataEnd))
  out.set(bytes.subarray(insertAt), dataEnd + 4)
  return out
}
