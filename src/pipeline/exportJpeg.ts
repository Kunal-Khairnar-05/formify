import { encodeJpeg } from './encode'
import { fitKb } from './fitKb'
import { padJpeg } from './pad'
import type { Measurement, Spec } from './types'
import { measure, validate } from './validate'

// used when the spec sets no size limits
const DEFAULT_QUALITY = 90
// the normal ceiling; above it files grow fast for no visible gain
const USUAL_TOP_QUALITY = 95
// only used when a minimum size has to be reached
const TOP_QUALITY = 100
// aim 5% above a minimum, counting 1 KB as 1024 bytes (the stricter reading for a minimum)
const MIN_SAFETY = 1.05

export interface Exported {
  bytes: Uint8Array
  quality: number
  /** Bytes of padding added to reach the spec's minimum size; 0 when none was needed. */
  paddedBytes: number
  measured: Measurement
  /** Ways the file breaks the spec; empty means it is safe to hand over. */
  problems: string[]
}

/**
 * The size in bytes to pad up to for a minimum of `minKb`: 5% above it when the maximum
 * leaves room, otherwise as close to that as the maximum allows.
 */
export function minTarget(minKb: number, maxKb?: number): number {
  const wanted = Math.ceil(minKb * 1024 * MIN_SAFETY)
  if (maxKb === undefined) return wanted
  // stay under the same 5% margin that fitKb keeps below the maximum
  return Math.min(wanted, Math.floor(maxKb * 1000 * 0.95))
}

/** Step 8: encode to the spec's size limits, then measure the result against the spec. */
export async function exportJpeg(pixels: ImageData, spec: Spec): Promise<Exported | null> {
  const encode = (quality: number) => encodeJpeg(pixels, quality)
  const { minKb, maxKb } = spec
  let bytes: Uint8Array
  let quality: number

  if (maxKb !== undefined) {
    // with a minimum to reach, quality may go all the way up before any padding
    const top = minKb === undefined ? USUAL_TOP_QUALITY : TOP_QUALITY
    const fit = await fitKb(encode, maxKb, top)
    if (!fit) return null
    bytes = fit.bytes
    quality = fit.quality
  } else {
    quality = DEFAULT_QUALITY
    bytes = await encode(quality)
    if (minKb !== undefined && bytes.length < minTarget(minKb)) {
      quality = TOP_QUALITY
      bytes = await encode(quality)
    }
  }

  // still too small at the best quality: the picture cannot grow, so the file is padded
  let paddedBytes = 0
  if (minKb !== undefined) {
    const padded = padJpeg(bytes, minTarget(minKb, maxKb))
    paddedBytes = padded.length - bytes.length
    bytes = padded
  }

  return { bytes, quality, paddedBytes, measured: measure(bytes), problems: validate(bytes, spec) }
}
