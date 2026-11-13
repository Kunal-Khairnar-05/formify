import type { Region } from '../crop/region'
import { encodeJpeg } from '../pipeline/encode'
import { cropSource } from '../pipeline/precrop'
import { encodePng } from '../pipeline/png'
import type { Spec } from '../pipeline/types'

// the lowest and the usual highest JPG quality the app will use (see fitKb and exportJpeg)
const LOWEST_QUALITY = 40
const BEST_QUALITY = 95

/**
 * What the chosen part of the photo weighs at the output size, with its own background
 * still in place. The finished picture has a plain background, which stores smaller, so
 * these are upper marks: the real file is at or below them.
 */
export interface Measured {
  /** Bytes at the lowest quality the app will use; for a PNG, the one size it can be. */
  smallestBytes: number
  /** Bytes at the best quality; the same as smallestBytes for a PNG. */
  bestBytes: number
}

/** Store the chosen part of the photo at the output size and see what it weighs. */
export async function measurePicture(file: Blob, region: Region, spec: Spec): Promise<Measured> {
  const crop = await cropSource(file, region)
  const canvas = new OffscreenCanvas(spec.widthPx, spec.heightPx)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(crop, 0, 0, spec.widthPx, spec.heightPx)
  crop.close()
  const pixels = ctx.getImageData(0, 0, spec.widthPx, spec.heightPx)

  if (spec.format === 'png') {
    const bytes = (await encodePng(pixels)).length
    return { smallestBytes: bytes, bestBytes: bytes }
  }
  const [smallest, best] = await Promise.all([
    encodeJpeg(pixels, LOWEST_QUALITY),
    encodeJpeg(pixels, BEST_QUALITY),
  ])
  return { smallestBytes: smallest.length, bestBytes: best.length }
}
