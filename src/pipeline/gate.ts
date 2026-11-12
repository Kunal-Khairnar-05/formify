/** Grow a mask outward by `radius` pixels: each pixel takes the largest value near it. */
export function dilate(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  // a square "max" filter splits into two cheap passes: along rows, then along columns
  const rows = new Float32Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = Math.max(0, x - radius)
      const to = Math.min(width - 1, x + radius)
      let best = 0
      for (let k = from; k <= to; k++) best = Math.max(best, mask[y * width + k])
      rows[y * width + x] = best
    }
  }

  const out = new Float32Array(mask.length)
  for (let y = 0; y < height; y++) {
    const from = Math.max(0, y - radius)
    const to = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x++) {
      let best = 0
      for (let k = from; k <= to; k++) best = Math.max(best, rows[k * width + x])
      out[y * width + x] = best
    }
  }
  return out
}

/** Keep the matte only where the gate allows it: the smaller of the two at each pixel. */
export function limitTo(matte: Float32Array, gate: Float32Array): Float32Array {
  const out = new Float32Array(matte.length)
  for (let i = 0; i < matte.length; i++) out[i] = Math.min(matte[i], gate[i])
  return out
}

// matte values above this count as fully opaque
const SOLID = 0.9

/**
 * Outside `who`, keep only the soft part of the mask: remove solid pixels
 * and everything within `margin` pixels of them. Inside `who` nothing changes.
 */
export function softOutside(
  mask: Float32Array,
  who: Float32Array,
  width: number,
  height: number,
  margin = 4,
): Float32Array {
  // solid pixels that the "who" mask does not claim: a neighbour, or an object touching the person
  const intruders = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    if (who[i] < 0.5 && mask[i] > SOLID) intruders[i] = 1
  }

  // their soft outline has to go too, so widen them by the margin
  const blocked = dilate(intruders, width, height, margin)

  const out = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    out[i] = who[i] < 0.5 && blocked[i] > 0 ? 0 : mask[i]
  }
  return out
}