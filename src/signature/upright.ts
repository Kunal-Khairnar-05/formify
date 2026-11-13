import type { Rect } from '../pipeline/types'

// the ink has to be this much taller than wide before it is taken to be lying on its side
const SIDEWAYS = 1.2
// how far the weight of the ink must sit from the middle, as a fraction of the signature's
// height, before the guess counts as confident
const CONFIDENT = 0.04

export interface Upright {
  /** Clockwise quarter turns that should make the signature read left to right, the right way up. */
  turns: number
  /** False when the evidence is weak and the user should check the result. */
  confident: boolean
}

/**
 * Guess which way up a signature is, from the cleaned ink mask and the rectangle around it.
 *
 * Two things are used. First, a signature is wider than it is tall, so ink that is taller
 * than wide is lying on its side. Second, handwriting is bottom-heavy: the body of the
 * letters sits on the baseline, more strokes reach up (b, d, h, k, l, t, capitals) than hang
 * down (g, p, y), and an underline goes underneath. So the weight of the ink lies below the
 * middle of the signature when it is the right way up.
 *
 * It is a guess, not a reading of the letters: an unusual signature can fool it.
 */
export function uprightTurns(mask: Float32Array, width: number, ink: Rect): Upright {
  // ink per row and per column, inside the rectangle
  const rows = new Float64Array(ink.height)
  const columns = new Float64Array(ink.width)
  for (let y = 0; y < ink.height; y++) {
    for (let x = 0; x < ink.width; x++) {
      const value = mask[(ink.y + y) * width + ink.x + x]
      rows[y] += value
      columns[x] += value
    }
  }

  const sideways = ink.height > ink.width * SIDEWAYS
  // after a clockwise quarter turn, what was left-to-right runs top-to-bottom,
  // so a sideways signature is judged on its columns
  const profile = sideways ? columns : rows

  let total = 0
  let weighted = 0
  for (let i = 0; i < profile.length; i++) {
    total += profile[i]
    weighted += profile[i] * i
  }
  if (total === 0) return { turns: 0, confident: false }

  // positive: the weight is past the middle, which is "below" in the upright picture
  const offset = weighted / total / (profile.length - 1 || 1) - 0.5
  const heavyEnd = offset >= 0
  const confident = Math.abs(offset) >= CONFIDENT

  if (sideways) return { turns: heavyEnd ? 1 : 3, confident }
  // turning a picture upside down on weak evidence does more harm than leaving it:
  // most photos are taken the right way up
  return { turns: heavyEnd || !confident ? 0 : 2, confident }
}
