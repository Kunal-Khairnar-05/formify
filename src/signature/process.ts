import type { Region } from '../crop/region'
import { composite } from '../pipeline/composite'
import { exportJpeg, type Exported } from '../pipeline/exportJpeg'
import { loadImage } from '../pipeline/loadImage'
import { cropSource } from '../pipeline/precrop'
import { cropAndResize } from '../pipeline/resize'
import type { Rect, Spec } from '../pipeline/types'
import { signatureBox } from './box'
import { pickContrast } from './contrast'
import { darkness, inkBounds, inkMask, luminance } from './ink'

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
  /** The photo after loading and the user's crop. */
  image: ImageBitmap
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

/** Signature pipeline: photo of a signature on paper in, clean spec-sized JPEG out. */
export async function processSignature(
  file: Blob,
  spec: Spec,
  /** Part of the photo to use, chosen by the user; the whole photo when left out. */
  region?: Region,
): Promise<ProcessedSignature> {
  const timingsMs: Record<string, number> = {}
  let mark = performance.now()
  const lap = (name: string) => {
    const now = performance.now()
    timingsMs[name] = Math.round(now - mark)
    mark = now
  }

  const image = await loadImage(region ? await cropSource(file, region) : file, WORKING_EDGE)
  const { width, height } = image
  lap('load')

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const gray = luminance(ctx.getImageData(0, 0, width, height))

  const radius = Math.max(4, Math.round(Math.max(width, height) * MAX_STROKE))
  const dark = darkness(gray, width, height, radius)
  const mask = inkMask(dark, pickContrast(dark))
  const ink = inkBounds(mask, width, height, MIN_INK)
  lap('ink')
  if (!ink) return { image, timingsMs }

  const box = signatureBox(ink, spec.widthPx / spec.heightPx, MARGIN)
  // only the ink is kept; the paper, with its colour and shadows, becomes the background
  const pixels = composite(image, mask, spec.background)
  const final = await cropAndResize(pixels, box, spec.widthPx, spec.heightPx, spec.background)
  lap('crop, resize')

  const warnings: string[] = []
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

  const exported = await exportJpeg(final, spec)
  lap('encode')

  return { image, stages: { mask, ink, box, final, exported, warnings }, timingsMs }
}
