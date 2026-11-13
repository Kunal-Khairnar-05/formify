import type { Spec } from '../pipeline/types'
import { resolveSpec, type SpecInput } from './units'

/** What is being made; some checks differ between a photo and a signature. */
export type Kind = 'photo' | 'signature'

/**
 * The outcome of checking what the user asked for. Errors are things that cannot be made
 * at all; cautions are things that can be made but are probably a mistake or will look poor.
 */
export type Checked =
  | { ok: true; spec: Spec; cautions: string[] }
  | { ok: false; errors: string[] }

// fitKb aims 5% under the maximum, so that much of the limit is not usable
const USABLE = 0.95
// DPI values outside this range are almost always a typing mistake
const USUAL_DPI = { min: 72, max: 600 }
// a side this many times the other is treated as a likely mistake
const LONG_PHOTO = 2.5
const LONG_SIGNATURE = 8

/**
 * The smallest JPG a picture of this many pixels can be: a blank one at the lowest quality
 * the app uses. Measured with the app's own encoder from 100 x 120 to 1600 x 2057 px; a
 * blank picture came to 351 to 19,617 bytes, always above this line.
 */
export function smallestJpeg(pixels: number): number {
  return 200 + 0.0055 * pixels
}

/**
 * About what a real photo on a plain background needs at the lowest quality the app uses.
 * From one test photo at five sizes (1.3 KB at 100 x 120 px to 60 KB at 1600 x 2057 px);
 * the size grows more slowly than the pixel count because a larger output of the same
 * photo holds no more detail. A guide, not a limit: it only decides whether to caution.
 */
export function typicalPhotoJpeg(pixels: number): number {
  return 2.2 * pixels ** 0.68
}

/**
 * About what a photo on a plain background comes to as a PNG. From one test photo at four
 * sizes: 1.5 bytes a pixel at 100 x 120 px down to 1.1 at 826 x 1062 px. A guide, not a
 * limit: it only decides whether to caution.
 */
export function typicalPhotoPng(pixels: number): number {
  return 1.1 * pixels
}

const kb = (bytes: number) => {
  const value = bytes / 1000
  return value < 10 ? value.toFixed(1) : Math.round(value).toString()
}

/** Checks that need the size in pixels: whether the limits can be met at that size. */
export function checkSpec(
  spec: Spec,
  input: SpecInput,
  kind: Kind,
): { errors: string[]; cautions: string[] } {
  const errors: string[] = []
  const cautions: string[] = []
  const { widthPx, heightPx, minKb, maxKb } = spec
  const pixels = widthPx * heightPx
  const size = `${widthPx} x ${heightPx} px`

  // a pixel cannot be divided
  if (input.unit === 'px' && (!Number.isInteger(input.width) || !Number.isInteger(input.height))) {
    errors.push('Pixels must be whole numbers. Check the width and height, or change the unit.')
  }

  // portals disagree on whether 1 KB is 1000 or 1024 bytes, so a file must satisfy both
  // readings: at least min x 1024 bytes and at most max x 1000 bytes
  if (minKb !== undefined && maxKb !== undefined && minKb * 1024 > maxKb * 1000) {
    errors.push(
      `No file can be safely both at least ${minKb} KB and at most ${maxKb} KB: the limits are ` +
        'too close together. Check them against the portal.',
    )
  }

  if (maxKb !== undefined && spec.format === 'png') {
    // a PNG cannot be squeezed, so a photo either fits as it is or does not
    if (kind === 'photo' && maxKb * 1000 < typicalPhotoPng(pixels)) {
      cautions.push(
        `A PNG photo of ${size} is usually about ${kb(typicalPhotoPng(pixels))} KB, well over ` +
          `${maxKb} KB, and a PNG cannot be made smaller. If the portal allows JPG, choose that.`,
      )
    }
  } else if (maxKb !== undefined) {
    const budget = maxKb * 1000 * USABLE
    if (budget < smallestJpeg(pixels)) {
      errors.push(
        `${size} cannot fit in ${maxKb} KB: even a blank picture of that size is about ` +
          `${kb(smallestJpeg(pixels))} KB as a JPG. Check the size and the limit against the portal.`,
      )
    } else if (kind === 'photo' && budget < typicalPhotoJpeg(pixels)) {
      cautions.push(
        `${maxKb} KB is very little for ${size}: a photo of that size usually needs about ` +
          `${kb(typicalPhotoJpeg(pixels) / USABLE)} KB or more. It may not fit, or may look blocky.`,
      )
    }
  }

  if (input.unit !== 'px' && (input.dpi < USUAL_DPI.min || input.dpi > USUAL_DPI.max)) {
    cautions.push(
      `${input.dpi} DPI is unusual; forms normally ask for ${USUAL_DPI.min} to ${USUAL_DPI.max}. ` +
        `It gives ${size}.`,
    )
  }

  const ratio = Math.max(widthPx, heightPx) / Math.min(widthPx, heightPx)
  if (kind === 'photo') {
    if (ratio > LONG_PHOTO) {
      cautions.push(`${size} is a very long shape for a photo. Check the width and height.`)
    } else if (widthPx > heightPx) {
      cautions.push(
        'This photo is wider than it is tall. Form photos are usually taller than wide: check that ' +
          'width and height are not swapped.',
      )
    }
  } else if (heightPx > widthPx) {
    cautions.push(
      'This signature is taller than it is wide. Signatures are usually wider than tall: check that ' +
        'width and height are not swapped.',
    )
  } else if (ratio > LONG_SIGNATURE) {
    cautions.push(`${size} is a very long shape for a signature. Check the width and height.`)
  }

  return { errors, cautions }
}

/** Check everything the user asked for: first that it makes sense, then that it can be made. */
export function resolveChecked(input: SpecInput, kind: Kind): Checked {
  const resolved = resolveSpec(input)
  if (!resolved.ok) return resolved
  const { errors, cautions } = checkSpec(resolved.spec, input, kind)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec: resolved.spec, cautions }
}

/**
 * A caution for a crop that holds fewer pixels than the output needs, or null. The picture
 * can still be made, but it is enlarged, and enlarging cannot add detail.
 */
export function cropCaution(cropWidthPx: number, cropHeightPx: number, spec: Spec): string | null {
  const shortBy = Math.max(spec.widthPx / cropWidthPx, spec.heightPx / cropHeightPx)
  // a little enlargement is not visible
  if (shortBy <= 1.15) return null
  return (
    `The part you chose is ${Math.round(cropWidthPx)} x ${Math.round(cropHeightPx)} px but the form ` +
    `needs ${spec.widthPx} x ${spec.heightPx} px, so it will be enlarged about ` +
    `${shortBy.toFixed(1)} times and look soft. Choose a larger part or a sharper photo.`
  )
}
