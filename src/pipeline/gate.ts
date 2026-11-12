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