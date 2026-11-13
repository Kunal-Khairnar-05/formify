import type { Region } from '../crop/region'
import { exportImage, type Exported } from '../pipeline/export'
import { loadImage } from '../pipeline/loadImage'
import { rotateQuarter } from '../pipeline/orient'
import { cropSource } from '../pipeline/precrop'
import type { Rect, Spec } from '../pipeline/types'
import { signatureBox } from './box'
import { pickContrast } from './contrast'
import { darkness, inkBounds, inkMask, luminance } from './ink'
import { dropFragments, dropLines } from './lines'
import { drawSignature } from './paint'
import { uprightTurns } from './upright'

// a signature needs less detail than a face, and the ink search is quicker on a smaller image
const WORKING_EDGE = 1024
// half the widest pen stroke that is kept, as a fraction of the longer side; anything
// dark and wider is taken for something other than ink (a table, a finger, a hard shadow)
const MAX_STROKE = 0.012
// rows and columns with fewer ink pixels than this are treated as specks
const MIN_INK = 3
// space left around the ink, as a fraction of its longer side
const MARGIN = 0.08

export interface ProcessedSignature {
  /** The photo after loading, the user's crop, and turning upright. */
  image: ImageBitmap
  /** Clockwise quarter turns applied. */
  turns: number
  /** True when the turns were guessed from the ink rather than given by the user. */
  guessed: boolean
  /** Present only when ink was found. */
  stages?: {
    mask: Float32Array
    /** The rectangle around the ink alone. */
    ink: Rect
    /** The rectangle that was cut out: the ink plus margin, in the output's shape. */
    box: Rect
    final: ImageData
    /** null when the spec's size limit cannot be met. */
    exported: Exported | null
    warnings: string[]
  }
  timingsMs: Record<string, number>
}

/** Find the pen strokes: everything thin and dark, minus the paper's own lines. */
function findInk(image: ImageBitmap): { mask: Float32Array; ink: Rect | null; pixels: ImageData } {
  const { width, height } = image
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, width, height)

  const radius = Math.max(4, Math.round(Math.max(width, height) * MAX_STROKE))
  const dark = darkness(luminance(pixels), width, height, radius)
  const contrast = pickContrast(dark)
  const mask = dropFragments(
    inkMask(dropLines(dark, width, height, contrast), contrast),
    width,
    height,
  )
  return { mask, ink: inkBounds(mask, width, height, MIN_INK), pixels }
}

/** Signature pipeline: photo of a signature on paper in, clean spec-sized JPEG out. */
export async function processSignature(
  file: Blob,
  spec: Spec,
  /** Part of the photo to use, chosen by the user; the whole photo when left out. */
  region?: Region,
  /** Clockwise quarter turns to apply; guessed from the ink when left out. */
  turns?: number,
  /** Told what is about to start, in words for the user; awaited so the page can show it. */
  onStage?: (stage: string) => void | Promise<void>,
): Promise<ProcessedSignature> {
  const timingsMs: Record<string, number> = {}
  let mark = performance.now()
  const lap = (name: string) => {
    const now = performance.now()
    timingsMs[name] = Math.round(now - mark)
    mark = now
  }

  await onStage?.('Reading your photo')
  let image = await loadImage(region ? await cropSource(file, region) : file, WORKING_EDGE)
  lap('load')

  await onStage?.('Finding the ink')
  let found = findInk(image)
  lap('ink')

  // which way up: the user's choice, or a guess from the ink
  const guessed = turns === undefined
  let confident = true
  let applied = turns ?? 0
  if (guessed && found.ink) {
    const guess = uprightTurns(found.mask, image.width, found.ink)
    applied = guess.turns
    confident = guess.confident
  }
  if (applied !== 0) {
    await onStage?.('Turning it upright')
    image = rotateQuarter(image, applied)
    // the lines and the stroke shapes are found afresh in the turned picture
    found = findInk(image)
    lap('turn')
  }

  const { mask, ink, pixels } = found
  const { width, height } = image
  if (!ink) return { image, turns: applied, guessed, timingsMs }

  const box = signatureBox(ink, spec.widthPx / spec.heightPx, MARGIN)
  // only the ink is kept, redrawn in one colour; the paper becomes the background
  const final = await drawSignature(
    pixels,
    mask,
    box,
    spec.widthPx,
    spec.heightPx,
    spec.background,
  )
  lap('crop, resize')

  const warnings: string[] = []
  if (guessed && applied !== 0) {
    warnings.push(
      `The signature looked ${applied === 2 ? 'upside down' : 'sideways'}, so it was turned. ` +
        'Use Rotate if it is still the wrong way round.',
    )
  }
  // an unsure guess matters only when the picture was turned on the strength of it
  if (guessed && !confident && applied !== 0) {
    warnings.push('Could not tell for sure which way up the signature is. Use Rotate if it is wrong.')
  }
  if (box.width < spec.widthPx) {
    warnings.push(
      `Low resolution: the signature is ${box.width} x ${box.height} px in the photo but the form ` +
        `needs ${spec.widthPx} x ${spec.heightPx} px, so the result is enlarged and will look soft.`,
    )
  }
  // ink on the very edge usually means the signature runs out of the photo or crop
  if (ink.x === 0 || ink.y === 0 || ink.x + ink.width === width || ink.y + ink.height === height) {
    warnings.push(
      'Something dark touches the edge of the photo or crop. If part of the signature is cut off, ' +
        'or the edge of the paper is in view, crop to the signature alone.',
    )
  }

  await onStage?.('Fitting the file size')
  const exported = await exportImage(final, spec)
  lap('encode')

  return {
    image,
    turns: applied,
    guessed,
    stages: { mask, ink, box, final, exported, warnings },
    timingsMs,
  }
}
