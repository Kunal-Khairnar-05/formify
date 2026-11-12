import type { FaceGeometry, Rect } from './types'

/** Step 5 (you type): crop box of the target ratio with the face centred and headroom above. */
export function cropBox(
  _face: FaceGeometry,
  _imageWidth: number,
  _imageHeight: number,
  _targetRatio: number,
): Rect {
  throw new Error('cropBox: not implemented')
}
