import type { FaceGeometry } from './types'

// Measurements of the source photo that predict a rejection. Each one only measures;
// the limits that turn a number into a warning live in sourceWarnings.ts.

/**
 * How far the head leans, in degrees: 0 when the eyes are level, positive when the head
 * leans clockwise as seen in the photo.
 */
export function headTilt(face: Pick<FaceGeometry, 'leftEye' | 'rightEye'>): number {
  const dx = face.rightEye.x - face.leftEye.x
  const dy = face.rightEye.y - face.leftEye.y
  // atan2 gives the angle of the eye line in radians; y grows downward in a picture,
  // so a lower right eye is a positive angle
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/** Mean brightness of a grey picture, 0 (black) to 1 (white). */
export function brightness(gray: Float32Array): number {
  if (gray.length === 0) return 0
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  return sum / gray.length
}

/**
 * How uneven the light is from side to side: mean brightness of the left half minus the
 * right half. 0 is even; positive means the left side is brighter.
 */
export function sideBalance(gray: Float32Array, width: number, height: number): number {
  // with an odd width the middle column belongs to neither half
  const half = Math.floor(width / 2)
  if (half === 0 || height === 0) return 0
  let left = 0
  let right = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < half; x++) {
      left += gray[y * width + x]
      right += gray[y * width + (width - 1 - x)]
    }
  }
  return (left - right) / (half * height)
}

/**
 * How sharp a grey picture is: the variance of its Laplacian. The Laplacian of a pixel is
 * four times its value minus its four neighbours, which is near 0 on smooth areas and large
 * at edges. A sharp picture has strong edges, so the values spread widely; blur flattens them.
 */
export function sharpness(gray: Float32Array, width: number, height: number): number {
  // border pixels have no full set of neighbours, so only the inside is used
  if (width < 3 || height < 3) return 0
  let sum = 0
  let sumOfSquares = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const laplacian = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]
      sum += laplacian
      sumOfSquares += laplacian * laplacian
    }
  }
  const count = (width - 2) * (height - 2)
  const mean = sum / count
  // variance = mean of the squares minus the square of the mean
  return sumOfSquares / count - mean * mean
}