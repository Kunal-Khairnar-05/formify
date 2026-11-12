import type { FaceGeometry, Rect } from './types'

// crown-to-chin height as a fraction of the crop height
const HEAD_SHARE = 0.65
// empty space above the crown, as a fraction of the crop height
const TOP_MARGIN = 0.1

/** Step 5: crop box of the target ratio with the face centred and headroom above. */
/** Step 5: crop box of the target ratio with the face centred and headroom above. */
export function cropBox(
  face: FaceGeometry,
  imageWidth: number,
  imageHeight: number,
  targetRatio: number, // width / height
): Rect {
  const headHeight = face.chin.y - face.crown.y
  const centreX = (face.leftEye.x + face.rightEye.x) / 2

  // ideal size: the head fills HEAD_SHARE of the height.
  // The box may rise above the photo (that area becomes background), but it must
  // never drop below it: white under cut-off shoulders would look wrong.
  const ideal = headHeight / HEAD_SHARE
  const tallestThatFits = (imageHeight - face.crown.y) / (1 - TOP_MARGIN)
  const height = Math.min(ideal, tallestThatFits)
  const width = height * targetRatio

  const y = face.crown.y - TOP_MARGIN * height

  // sideways: slide to stay inside when the box fits; if it is wider than the
  // photo, keep the face centred and let both sides become background
  const centred = centreX - width / 2
  const x = width <= imageWidth ? Math.min(Math.max(centred, 0), imageWidth - width) : centred

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.floor(width),
    height: Math.floor(height),
  }
}