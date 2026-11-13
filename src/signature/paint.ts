import { dilate } from '../pipeline/gate'
import { cropAndResize } from '../pipeline/resize'
import type { Rect } from '../pipeline/types'

// a stroke should stay at least about this many pixels wide in the output
const MIN_OUTPUT_STROKE = 1.4
// ink colours are taken from pixels that are at least this much ink
const SOLID = 0.8
// how much darker than the photographed ink the output ink is drawn (1 = unchanged)
const DARKEN = 0.75

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
 * Push a soft edge towards ink or paper: below 0.3 becomes 0, above 0.7 becomes 1, with a
 * smooth step between. Shrinking a picture averages each stroke with the paper beside it,
 * which is what makes small signatures look blurred; this undoes most of that.
 */
export function sharpen(alpha: number): number {
  const t = Math.min(1, Math.max(0, (alpha - 0.3) / 0.4))
  return t * t * (3 - 2 * t)
}

/**
 * Redraw the signature as one ink colour on the background colour, at the output size.
 * The photographed ink is uneven and greyed by the paper showing through its edges; one
 * colour, slightly darkened, reads clearly at the small sizes forms ask for. The strokes
 * are thickened before a large shrink so they do not fade, and the shape of the ink is
 * resized on its own and sharpened, so the edges stay crisp.
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
  const alpha = grow > 0 ? dilate(mask, width, height, grow) : mask

  // the shape of the ink as a grey picture: black ink on white, so it can be resized
  const shape = new ImageData(width, height)
  for (let i = 0; i < alpha.length; i++) {
    const v = 255 * (1 - alpha[i])
    shape.data[i * 4] = v
    shape.data[i * 4 + 1] = v
    shape.data[i * 4 + 2] = v
    shape.data[i * 4 + 3] = 255
  }
  const small = await cropAndResize(shape, box, outWidth, outHeight, '#ffffff')

  const [bgR, bgG, bgB] = toRgb(background)
  const [inkR, inkG, inkB] = (inkColour(pixels.data, mask) ?? [0, 0, 0]).map((v) => v * DARKEN)

  const out = new ImageData(outWidth, outHeight)
  for (let i = 0; i < outWidth * outHeight; i++) {
    const a = sharpen(1 - small.data[i * 4] / 255)
    const o = i * 4
    out.data[o] = inkR * a + bgR * (1 - a)
    out.data[o + 1] = inkG * a + bgG * (1 - a)
    out.data[o + 2] = inkB * a + bgB * (1 - a)
    out.data[o + 3] = 255
  }
  return out
}
