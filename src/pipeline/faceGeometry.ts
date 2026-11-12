import type { FaceGeometry, Point } from './types'

// Indices into MediaPipe's 478-point face mesh
const FOREHEAD_TOP = 10
const CHIN = 152
const LEFT_EYE_CORNERS = [33, 133] as const // "left" as seen in the image
const RIGHT_EYE_CORNERS = [263, 362] as const

// The mesh stops near the hairline. The head continues above it by about this
// fraction of the forehead-to-chin distance. Starting value; tune on the test set.
const CROWN_EXTENSION = 0.3

/** Step 2b: 478 normalised landmarks -> face geometry in image pixels. */
export function faceGeometry(
  landmarks: { x: number; y: number }[],
  imageWidth: number,
  imageHeight: number,
): FaceGeometry {
  const px = (i: number): Point => ({
    x: landmarks[i].x * imageWidth,
    y: landmarks[i].y * imageHeight,
  })
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of landmarks) {
    minX = Math.min(minX, p.x * imageWidth)
    minY = Math.min(minY, p.y * imageHeight)
    maxX = Math.max(maxX, p.x * imageWidth)
    maxY = Math.max(maxY, p.y * imageHeight)
  }

  const forehead = px(FOREHEAD_TOP)
  const chin = px(CHIN)
  // continue the chin -> forehead line upward, so a tilted head still gets a sensible crown
  const crown: Point = {
    x: forehead.x + (forehead.x - chin.x) * CROWN_EXTENSION,
    y: forehead.y + (forehead.y - chin.y) * CROWN_EXTENSION,
  }

  return {
    box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    leftEye: mid(px(LEFT_EYE_CORNERS[0]), px(LEFT_EYE_CORNERS[1])),
    rightEye: mid(px(RIGHT_EYE_CORNERS[0]), px(RIGHT_EYE_CORNERS[1])),
    chin,
    crown,
  }
}