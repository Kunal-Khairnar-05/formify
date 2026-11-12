import type { FaceGeometry } from './types'

/** Step 2b (you type): 478 normalised landmarks -> face geometry in image pixels. */
export function faceGeometry(
  _landmarks: { x: number; y: number }[],
  _imageWidth: number,
  _imageHeight: number,
): FaceGeometry {
  throw new Error('faceGeometry: not implemented')
}
