import type { Spec } from '../pipeline/types'
import type { Measured } from './estimate'
import type { SpecFields } from './fields'
import { resolveSpec, toPixels, type SpecInput } from './units'

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
/*
 * How much smaller than the measured mark the finished photo can turn out. The mark is
 * taken with the photo's own background; the finished photo has a plain one. On two test
 * photos at three sizes each the finished file was 0.60 to 1.00 of the mark (JPG and PNG).
 * Below half the mark, the request is refused outright; between half and the whole mark it
 * is allowed with a caution.
 */
const CERTAIN = 0.5
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
  /** What the chosen photo weighs at this size, when one has been chosen and measured. */
  measured?: Measured,
): { errors: string[]; cautions: string[] } {
  const errors: string[] = []
  const cautions: string[] = []
  const { widthPx, heightPx, minKb, maxKb } = spec
  const pixels = widthPx * heightPx
  const size = `${widthPx} x ${heightPx} px`

  if (spec.format === 'svg' && kind === 'photo') {
    errors.push('SVG is a drawing made of curves, which suits a signature but not a photo. Choose JPG or PNG.')
  }

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

  if (maxKb !== undefined && kind === 'photo' && measured) {
    // the photo itself has been weighed at this size, which beats any rule of thumb
    const isPng = spec.format === 'png'
    const budget = isPng ? maxKb * 1000 : maxKb * 1000 * USABLE
    const needed = `${kb((measured.smallestBytes * CERTAIN * maxKb * 1000) / budget)} KB`
    if (budget < measured.smallestBytes * CERTAIN) {
      errors.push(
        isPng
          ? `As a PNG, this photo at ${size} needs about ${needed} or more, and a PNG cannot be made ` +
              `smaller. ${maxKb} KB cannot be met. Choose JPG if the portal allows it.`
          : `This photo at ${size} needs about ${needed} or more, even at the lowest quality. ` +
              `${maxKb} KB cannot be met. Check the size and the limit against the portal.`,
      )
    } else if (budget < measured.smallestBytes) {
      cautions.push(
        isPng
          ? `${maxKb} KB is tight for this photo as a PNG at ${size}. It may not fit, and a PNG cannot be made smaller.`
          : `${maxKb} KB is tight for this photo at ${size}. It may not fit, or may look blocky.`,
      )
    }
  } else if (maxKb !== undefined && spec.format === 'png') {
    // a PNG cannot be squeezed, so a photo either fits as it is or does not
    if (kind === 'photo' && maxKb * 1000 < typicalPhotoPng(pixels)) {
      cautions.push(
        `A PNG photo of ${size} is usually about ${kb(typicalPhotoPng(pixels))} KB, well over ` +
          `${maxKb} KB, and a PNG cannot be made smaller. If the portal allows JPG, choose that.`,
      )
    }
  } else if (maxKb !== undefined && spec.format === 'jpg') {
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
export function resolveChecked(input: SpecInput, kind: Kind, measured?: Measured): Checked {
  const resolved = resolveSpec(input)
  if (!resolved.ok) return resolved
  const { errors, cautions } = checkSpec(resolved.spec, input, kind, measured)
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

/** A box of the form, by the name of its field. */
export type FieldName = keyof SpecFields

/**
 * The boxes whose values are behind the errors, so the form can mark them. Follows the same
 * rules as resolveSpec and checkSpec; empty when the request can be made.
 */
export function badFields(input: SpecInput, kind: Kind, measured?: Measured): FieldName[] {
  const bad = new Set<FieldName>()
  const positive = (n: number) => Number.isFinite(n) && n > 0
  const { minKb, maxKb } = input

  if (!positive(input.width)) bad.add('width')
  if (!positive(input.height)) bad.add('height')
  if (input.unit !== 'px' && !positive(input.dpi)) bad.add('dpi')
  if (minKb !== undefined && !positive(minKb)) bad.add('minKb')
  if (maxKb !== undefined && !positive(maxKb)) bad.add('maxKb')
  if (minKb !== undefined && maxKb !== undefined && positive(minKb) && positive(maxKb)) {
    // the wrong way round, or too close together to satisfy both readings of 1 KB
    if (minKb >= maxKb || minKb * 1024 > maxKb * 1000) {
      bad.add('minKb')
      bad.add('maxKb')
    }
  }
  if (input.unit === 'px') {
    if (positive(input.width) && !Number.isInteger(input.width)) bad.add('width')
    if (positive(input.height) && !Number.isInteger(input.height)) bad.add('height')
  }
  if (bad.size > 0) return [...bad]

  const resolved = resolveSpec(input)
  if (!resolved.ok) {
    // what is left is a side outside the range the app can make
    const side = (value: number) => toPixels(value, input.unit, input.dpi)
    const outside = (px: number) => px < 20 || px > 4000
    if (outside(side(input.width))) bad.add('width')
    if (outside(side(input.height))) bad.add('height')
    return [...bad]
  }

  // a limit this size, or this photo, cannot meet
  if (checkSpec(resolved.spec, input, kind, measured).errors.length > 0) {
    bad.add('maxKb')
    if (resolved.spec.format !== 'jpg') bad.add('format')
    // an SVG photo is refused whatever the limit is
    if (resolved.spec.format === 'svg' && kind === 'photo') bad.delete('maxKb')
  }
  return [...bad]
}

/** A change to the form that would fix a problem or suit the picture better. */
export interface Suggestion {
  /** What the change is and why. */
  text: string
  /** The words on the button that makes the change. */
  action: string
  /** The form fields to set. */
  patch: Partial<SpecFields>
}

// a limit is suggested as a round number of KB
const roundUp = (value: number, step: number) => Math.ceil(value / step) * step
const stepFor = (kbValue: number) => (kbValue > 100 ? 10 : kbValue > 20 ? 5 : 1)

/**
 * Changes worth offering: first what would make an impossible request possible, then what
 * would suit the chosen picture better. The portal's own rules come first, so these are
 * offers, never applied on their own.
 */
export function suggest(
  kind: Kind,
  input: SpecInput,
  /** The chosen part of the photo in pixels, when a photo has been chosen. */
  crop?: { width: number; height: number },
  measured?: Measured,
): Suggestion[] {
  const out: Suggestion[] = []
  const { minKb, maxKb } = input

  if (input.unit === 'px' && (!Number.isInteger(input.width) || !Number.isInteger(input.height))) {
    if (Number.isFinite(input.width) && Number.isFinite(input.height)) {
      const width = Math.round(input.width)
      const height = Math.round(input.height)
      out.push({
        text: `Pixels cannot be divided. The nearest whole size is ${width} x ${height} px.`,
        action: `Use ${width} x ${height} px`,
        patch: { width: String(width), height: String(height) },
      })
    }
  }

  if (minKb !== undefined && maxKb !== undefined && minKb < maxKb && minKb * 1024 > maxKb * 1000) {
    // the largest minimum that still leaves a size under the maximum
    const lower = Math.floor((maxKb * 1000) / 1024)
    if (lower >= 1) {
      out.push({
        text: `With a ${maxKb} KB maximum, the highest minimum that can be met is ${lower} KB.`,
        action: `Set the minimum to ${lower} KB`,
        patch: { minKb: String(lower) },
      })
    }
  }

  const resolved = resolveSpec(input)
  if (!resolved.ok) return out
  const { spec } = resolved
  const pixels = spec.widthPx * spec.heightPx
  const isPng = spec.format === 'png'

  if (spec.format === 'svg') {
    // a drawing's size depends on the signature, not on the pixel count: no limit to suggest
    if (kind === 'photo') {
      out.push({
        text: 'SVG is only made for signatures. A photo is stored as JPG.',
        action: 'Switch to JPG',
        patch: { format: 'jpg' },
      })
    }
    return out
  }

  // a limit that is too low, or tight: say what would work
  if (maxKb !== undefined) {
    let neededBytes = 0
    if (kind === 'photo' && measured) neededBytes = measured.smallestBytes
    else if (!isPng) neededBytes = kind === 'photo' ? typicalPhotoJpeg(pixels) : smallestJpeg(pixels)
    else if (kind === 'photo') neededBytes = typicalPhotoPng(pixels)
    const budget = isPng ? maxKb * 1000 : maxKb * 1000 * USABLE

    if (neededBytes > budget) {
      if (isPng && kind === 'photo') {
        out.push({
          text: 'A JPG of the same photo is many times smaller than a PNG and looks the same at this size.',
          action: 'Switch to JPG',
          patch: { format: 'jpg' },
        })
      }
      const wanted = neededBytes / (isPng ? 1000 : 1000 * USABLE)
      const limit = roundUp(wanted, stepFor(wanted))
      out.push({
        text: `${isPng ? 'As a PNG, this' : 'This'} size fits comfortably from about ${limit} KB.`,
        action: `Set the maximum to ${limit} KB`,
        patch: { maxKb: String(limit) },
      })
    }
  } else if (kind === 'photo' && measured && !isPng) {
    const wanted = measured.bestBytes / (1000 * USABLE)
    const limit = roundUp(wanted, stepFor(wanted))
    out.push({
      text: `No maximum is set. This photo keeps its full quality within ${limit} KB.`,
      action: `Set the maximum to ${limit} KB`,
      patch: { maxKb: String(limit) },
    })
  }

  // the chosen part holds fewer pixels than the output: offer the most it can give
  if (kind === 'photo' && crop && cropCaution(crop.width, crop.height, spec)) {
    const scale = Math.min(crop.width / spec.widthPx, crop.height / spec.heightPx)
    const width = Math.floor(spec.widthPx * scale)
    const height = Math.floor(spec.heightPx * scale)
    if (width >= 20 && height >= 20) {
      out.push({
        text: `The sharpest this part of the photo can give, in the same shape, is ${width} x ${height} px.`,
        action: `Use ${width} x ${height} px`,
        patch: { width: String(width), height: String(height), unit: 'px' },
      })
    }
  }

  const swapped =
    (kind === 'photo' && spec.widthPx > spec.heightPx) || (kind === 'signature' && spec.heightPx > spec.widthPx)
  if (swapped) {
    out.push({
      text:
        kind === 'photo'
          ? 'Form photos are usually taller than wide.'
          : 'Signatures are usually wider than tall.',
      action: 'Swap width and height',
      patch: { width: String(input.height), height: String(input.width) },
    })
  }

  if (input.unit !== 'px' && (input.dpi < USUAL_DPI.min || input.dpi > USUAL_DPI.max)) {
    out.push({
      text: 'Most forms that give a size in cm, mm or inches mean 300 DPI.',
      action: 'Use 300 DPI',
      patch: { dpi: '300' },
    })
  }

  return out
}
