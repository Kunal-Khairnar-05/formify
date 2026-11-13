import { dilate } from '../pipeline/gate'

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
 * Redraw the signature as one ink colour on the background colour.
 * The photographed ink is uneven and greyed by the paper showing through its edges; one
 * colour, slightly darkened, reads clearly at the small sizes forms ask for. When the
 * picture is about to be shrunk a lot, the strokes are thickened first so they do not fade.
 */
export function paintInk(
  pixels: ImageData,
  mask: Float32Array,
  background: string,
  shrink: number,
): ImageData {
  const { width, height } = pixels
  const grow = thickenBy(shrink)
  const alpha = grow > 0 ? dilate(mask, width, height, grow) : mask

  const [bgR, bgG, bgB] = toRgb(background)
  const [inkR, inkG, inkB] = (inkColour(pixels.data, mask) ?? [0, 0, 0]).map((v) => v * DARKEN)

  const out = new ImageData(width, height)
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i]
    const o = i * 4
    out.data[o] = inkR * a + bgR * (1 - a)
    out.data[o + 1] = inkG * a + bgG * (1 - a)
    out.data[o + 2] = inkB * a + bgB * (1 - a)
    out.data[o + 3] = 255
  }
  return out
}
