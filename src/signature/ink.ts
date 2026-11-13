import { erode } from '../pipeline/edge'
import { dilate } from '../pipeline/gate'
import type { Rect } from '../pipeline/types'

/** Brightness of each pixel, 0 (black) to 1 (white). */
export function luminance(pixels: Pick<ImageData, 'data' | 'width' | 'height'>): Float32Array {
  const { data } = pixels
  const gray = new Float32Array(pixels.width * pixels.height)
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4
    // the eye is most sensitive to green and least to blue, so they are not weighted equally
    gray[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255
  }
  return gray
}

/**
 * How much darker each pixel is than the page would be there without any pen stroke.
 * A shadow across the page gives 0, and so does anything dark that is wider than `radius`
 * on both sides, such as the table around the paper: only thin dark marks stand out.
 */
export function darkness(
  gray: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  // "closing": spreading the bright paper over anything thin and dark erases the strokes,
  // then shrinking it back puts every wide edge exactly where it was
  const paper = erode(dilate(gray, width, height, radius), width, height, radius)

  const out = new Float32Array(gray.length)
  for (let i = 0; i < gray.length; i++) out[i] = Math.max(0, paper[i] - gray[i])
  return out
}

/** Where the ink is: 0 up to `contrast`, rising to 1 at twice that. */
export function inkMask(dark: Float32Array, contrast: number): Float32Array {
  const mask = new Float32Array(dark.length)
  for (let i = 0; i < dark.length; i++) {
    mask[i] = Math.min(1, Math.max(0, (dark[i] - contrast) / contrast))
  }
  return mask
}

/**
 * The smallest rectangle holding the ink, or null when there is none.
 * A row or column counts only if it has at least `minCount` ink pixels, so a stray speck
 * far from the signature does not stretch the rectangle.
 */
export function inkBounds(
  mask: Float32Array,
  width: number,
  height: number,
  minCount: number,
): Rect | null {
  const rows = new Uint32Array(height)
  const columns = new Uint32Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 0.5) {
        rows[y]++
        columns[x]++
      }
    }
  }

  const enough = (count: number) => count >= minCount
  const top = rows.findIndex(enough)
  const left = columns.findIndex(enough)
  if (top === -1 || left === -1) return null
  const bottom = rows.findLastIndex(enough)
  const right = columns.findLastIndex(enough)

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}