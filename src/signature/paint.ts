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

/** How many pixels to thicken the strokes by, so they survive being shrunk `shrink` times. */
export function thickenBy(shrink: number): number {
  // a ballpoint stroke is about 2 px in the working picture; growing by n adds 2n
  const needed = MIN_OUTPUT_STROKE * shrink
  return Math.max(0, Math.round((needed - 2) / 2))
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
  const grow = thickenBy(box.width / outWidth)
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
