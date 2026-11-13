import { luminance } from '../signature/ink'
import { brightness, headTilt, sharpness, sideBalance } from './checks'
import type { FaceGeometry } from './types'

// the face is measured at this width whatever its size in the photo, so that the numbers
// mean the same for a close-up and a distant shot
const PATCH_WIDTH = 128

// starting limits, set from the test photos; see the PR for the measurements
const MAX_TILT = 8
// kept low on purpose: skin tones differ, and a well-lit dark face must not be called dark
const TOO_DARK = 0.2
const TOO_BRIGHT = 0.8
// one side this much darker than the other, as a share of the face's brightness
const MAX_SIDE_DIFFERENCE = 0.3
const MIN_SHARPNESS = 0.003

/** What was measured on the face in the source photo. */
export interface FaceMeasures {
  /** Degrees the head leans; positive is clockwise as seen in the photo. */
  tilt: number
  /** Mean brightness of the face, 0 to 1. */
  brightness: number
  /** Left half minus right half of the face, as a share of the face's brightness. */
  balance: number
  /** Variance of the Laplacian over the face, for a face of brightness 1. */
  sharpness: number
}

/** Measure the face in the photo: its lean, its light and its sharpness. */
export function measureFace(image: ImageBitmap, face: FaceGeometry): FaceMeasures {
  const { box } = face
  const width = PATCH_WIDTH
  const height = Math.max(1, Math.round((PATCH_WIDTH * box.height) / box.width))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, width, height)
  const gray = luminance(ctx.getImageData(0, 0, width, height))

  // a darker photo of the same face has smaller differences everywhere: half the light
  // halves the side difference and quarters the Laplacian's variance. Dividing them out
  // keeps a dim photo from being called blurred, or a bright one from hiding a shadow.
  const mean = brightness(gray)
  const level = Math.max(mean, 0.01)
  return {
    tilt: headTilt(face),
    brightness: mean,
    balance: sideBalance(gray, width, height) / level,
    sharpness: sharpness(gray, width, height) / (level * level),
  }
}

/** Turn the measurements into warnings about what may get the photo rejected. */
export function sourceWarnings(measures: FaceMeasures): string[] {
  const warnings: string[] = []
  if (Math.abs(measures.tilt) > MAX_TILT) {
    warnings.push(
      `The head leans about ${Math.round(Math.abs(measures.tilt))} degrees. ` +
        'Forms usually want the head straight and level.',
    )
  }
  if (measures.brightness < TOO_DARK) {
    warnings.push('The face is dark. Use a photo taken in better light.')
  } else if (measures.brightness > TOO_BRIGHT) {
    warnings.push('The face is very bright and may be washed out. Use a photo with softer light.')
  }
  if (Math.abs(measures.balance) > MAX_SIDE_DIFFERENCE) {
    warnings.push(
      `The ${measures.balance > 0 ? 'right' : 'left'} side of the face is in shadow. ` +
        'Forms usually want even light on the face.',
    )
  }
  if (measures.sharpness < MIN_SHARPNESS) {
    warnings.push('The face looks blurred. Use a sharper photo.')
  }
  return warnings
}
