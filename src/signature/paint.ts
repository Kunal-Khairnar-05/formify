import { dilate } from '../pipeline/gate'
import type { Rect } from '../pipeline/types'

// a stroke should stay at least about this many pixels wide in the output
const MIN_OUTPUT_STROKE = 1.8
// ink colours are taken from pixels that are at least this much ink
const SOLID = 0.8
// how much darker than the photographed ink the output ink is drawn (1 = unchanged)
const DARKEN = 0.6
// mask values from here up are drawn as solid ink
const SOLID_FROM = 0.5
// how much a part-covered edge pixel is strengthened, so thin strokes do not look grey
const BOOST = 1.25

/** Turn any CSS colour into RGB bytes. */
function toRgb(colour: string): [number, number, number] {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/** The typical colour of the ink: the average over the pixels that are clearly ink. */
export function inkColour(
  data: ArrayLike<number>,
  mask: Float32Array,
): [number, number, number] | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] >= SOLID) {
      r += data[i * 4]
      g += data[i * 4 + 1]
      b += data[i * 4 + 2]
      count++
    }
  }
  return count === 0 ? null : [r / count, g / count, b / count]
}

/**
 * How wide the pen strokes are, in pixels: a ballpoint from a distance is about 2, a marker
 * in a close-up 15 or more. A stroke of length L and width w covers L * w pixels and has
 * about 2 * L pixels along its two edges, so the width is twice the area over the edge count.
 */
export function strokeWidth(mask: Float32Array, width: number, height: number): number {
  const isInk = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] > 0.5
  let area = 0
  let edge = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk(x, y)) continue
      area++
      if (!isInk(x - 1, y) || !isInk(x + 1, y) || !isInk(x, y - 1) || !isInk(x, y + 1)) edge++
    }
  }
  return edge === 0 ? 0 : (2 * area) / edge
}

/**
 * How many pixels to thicken strokes of width `stroke` by, so they survive being shrunk
 * `shrink` times. A stroke that is already wide enough is left alone: thickening it would
 * close up the loops of the letters.
 */
export function thickenBy(shrink: number, stroke: number): number {
  // growing by n adds 2n to the width
  const needed = MIN_OUTPUT_STROKE * shrink
  return Math.max(0, Math.round((needed - stroke) / 2))
}

/**
 * Resize one rectangle of a 0..1 map to the output size by averaging: every output pixel is
 * the mean of exactly the source area it covers, part-covered pixels counted in part. This
 * is what gives a small picture smooth edges without blur; skipping source pixels, as a
 * quick resize does, is what makes thin strokes look broken and jagged. Outside the map
 * counts as 0.
 */
export function resizeArea(
  values: Float32Array,
  width: number,
  height: number,
  box: Rect,
  outWidth: number,
  outHeight: number,
): Float32Array {
  // for each output position along one axis: the source pixels it covers and their weights
  const spans = (start: number, size: number, count: number, limit: number) => {
    const step = size / count
    // when enlarging, an output pixel covers less than one source pixel; a one-pixel
    // window around its centre then blends neighbours smoothly instead of copying one
    const reach = Math.max(step, 1)
    return Array.from({ length: count }, (_, i) => {
      const from = start + (i + 0.5) * step - reach / 2
      const to = from + reach
      const parts: [index: number, weight: number][] = []
      for (let k = Math.floor(from); k < to; k++) {
        const weight = (Math.min(k + 1, to) - Math.max(k, from)) / reach
        if (weight > 0 && k >= 0 && k < limit) parts.push([k, weight])
      }
      return parts
    })
  }
  const columns = spans(box.x, box.width, outWidth, width)
  const rows = spans(box.y, box.height, outHeight, height)

  const out = new Float32Array(outWidth * outHeight)
  for (let oy = 0; oy < outHeight; oy++) {
    for (let ox = 0; ox < outWidth; ox++) {
      let sum = 0
      for (const [y, wy] of rows[oy]) {
        let line = 0
        for (const [x, wx] of columns[ox]) line += values[y * width + x] * wx
        sum += line * wy
      }
      out[oy * outWidth + ox] = sum
    }
  }
  return out
}

/**
 * Redraw the signature as one ink colour on the background colour, at the output size.
 * The photographed ink is uneven and greyed by the paper showing through its edges; one
 * solid colour, slightly darkened, reads clearly at the small sizes forms ask for. The
 * strokes are thickened before a large shrink so they do not fade, and the shape of the ink
 * is shrunk by averaging, which keeps the edges smooth.
 */
export async function drawSignature(
  pixels: ImageData,
  mask: Float32Array,
  box: Rect,
  outWidth: number,
  outHeight: number,
  background: string,
): Promise<ImageData> {
  const { width, height } = pixels
  const grow = thickenBy(box.width / outWidth, strokeWidth(mask, width, height))
  const grown = grow > 0 ? dilate(mask, width, height, grow) : mask
  // anything at least half ink becomes solid, so a stroke is one even tone, not patchy
  const solid = grown.map((v) => Math.min(1, v / SOLID_FROM))
  const alpha = resizeArea(solid, width, height, box, outWidth, outHeight)

  const [bgR, bgG, bgB] = toRgb(background)
  const [inkR, inkG, inkB] = (inkColour(pixels.data, mask) ?? [0, 0, 0]).map((v) => v * DARKEN)

  const out = new ImageData(outWidth, outHeight)
  for (let i = 0; i < outWidth * outHeight; i++) {
    const a = Math.min(1, alpha[i] * BOOST)
    const o = i * 4
    out.data[o] = inkR * a + bgR * (1 - a)
    out.data[o + 1] = inkG * a + bgG * (1 - a)
    out.data[o + 2] = inkB * a + bgB * (1 - a)
    out.data[o + 3] = 255
  }
  return out
}
