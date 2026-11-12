import { encodeJpeg } from './encode'
import { fitKb } from './fitKb'
import type { Measurement, Spec } from './types'
import { measure, validate } from './validate'

// used when the spec sets no maximum size
const DEFAULT_QUALITY = 90

export interface Exported {
  bytes: Uint8Array
  quality: number
  measured: Measurement
  /** Ways the file breaks the spec; empty means it is safe to hand over. */
  problems: string[]
}

/** Step 8: encode to the spec's size limit, then measure the result against the spec. */
export async function exportJpeg(pixels: ImageData, spec: Spec): Promise<Exported | null> {
  let bytes: Uint8Array
  let quality = DEFAULT_QUALITY

  if (spec.maxKb === undefined) {
    bytes = await encodeJpeg(pixels, quality)
  } else {
    const fit = await fitKb((q) => encodeJpeg(pixels, q), spec.maxKb)
    if (!fit) return null
    bytes = fit.bytes
    quality = fit.quality
  }

  return { bytes, quality, measured: measure(bytes), problems: validate(bytes, spec) }
}
