import type { FitResult } from './types'

export type Encode = (quality: number) => Promise<Uint8Array>

const MIN_QUALITY = 40
const MAX_QUALITY = 95
// aim 5% under the limit, counting 1 KB as 1000 bytes (the stricter reading)
const SAFETY = 0.95

/** Step 7d: highest quality whose output fits under maxKb; null if none does. */
export async function fitKb(encode: Encode, maxKb: number, maxQuality = MAX_QUALITY,): Promise<FitResult | null> {
  const target = maxKb * 1000 * SAFETY
  
  let lo = MIN_QUALITY
  let hi = maxQuality
  let best: FitResult | null = null

  while (lo <= hi) {
    const quality = Math.floor((lo + hi) / 2)
    const bytes = await encode(quality)

    if (bytes.length <= target) {
      best = { bytes, quality } // fits: remember it and try for better quality
      lo = quality + 1
    } else {
      hi = quality - 1 // too big: go lower
    }
  }
  return best
}