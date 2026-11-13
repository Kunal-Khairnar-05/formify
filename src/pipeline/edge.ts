import { dilate } from './gate'

/** Shrink a mask inward by `radius` pixels. The image border does not count as an edge. */
export function erode(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  // shrinking the person is the same as growing the background
  const background = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) background[i] = 1 - mask[i]

  const grown = dilate(background, width, height, radius)

  const out = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = 1 - grown[i]
  return out
}

/** Average each pixel with its neighbours within `radius`, along rows then columns. */
export function boxBlur(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const rows = new Float32Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = Math.max(0, x - radius)
      const to = Math.min(width - 1, x + radius)
      let sum = 0
      for (let k = from; k <= to; k++) sum += mask[y * width + k]
      // divide by the pixels actually in the window, so the border is not darkened
      rows[y * width + x] = sum / (to - from + 1)
    }
  }

  const out = new Float32Array(mask.length)
  for (let y = 0; y < height; y++) {
    const from = Math.max(0, y - radius)
    const to = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = from; k <= to; k++) sum += rows[k * width + x]
      out[y * width + x] = sum / (to - from + 1)
    }
  }
  return out
}

/** Pull the edge in off the background, then feather it. */
export function softenEdge(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  return boxBlur(erode(mask, width, height, radius), width, height, radius)
}