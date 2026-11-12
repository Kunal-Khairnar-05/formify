import type { FaceGeometry, Rect } from './types'

// crown-to-chin height as a fraction of the crop height
const HEAD_SHARE = 0.65
// empty space above the crown, as a fraction of the crop height
const TOP_MARGIN = 0.1

/** Step 5: crop box of the target ratio with the face centred and headroom above. */
export function cropBox(
  face: FaceGeometry,
  imageWidth: number,
  imageHeight: number,
  targetRatio: number, // width / height
): Rect {
  const headHeight = face.chin.y - face.crown.y
  const centreX = (face.leftEye.x + face.rightEye.x) / 2

  // ideal size: the head fills HEAD_SHARE of the height
  let height = headHeight / HEAD_SHARE
  let width = height * targetRatio

  // the ideal box can be bigger than the photo: shrink it, keeping the ratio
  const fit = Math.min(1, imageWidth / width, imageHeight / height)
  width *= fit
  height *= fit

  // place it, then slide it back inside the image if it sticks out
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
  const x = clamp(centreX - width / 2, imageWidth - width)
  const y = clamp(face.crown.y - TOP_MARGIN * height, imageHeight - height)

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.floor(width),
    height: Math.floor(height),
  }
}