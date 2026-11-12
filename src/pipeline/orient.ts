import { faceGeometry } from './faceGeometry'
import { detectFaces, type Landmark } from './landmarks'
import type { FaceGeometry } from './types'

/**
 * (you type) How many clockwise quarter turns make this face upright: 0, 1, 2 or 3.
 * Read from the angle of the line between the eyes.
 */
export function quarterTurns(face: FaceGeometry): number {
  const dx = face.rightEye.x - face.leftEye.x
  const dy = face.rightEye.y - face.leftEye.y
  // 0 = eyes level; positive = the eye line is rotated clockwise on screen
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  // undo it with the nearest whole number of quarter turns, as 0..3
  return ((Math.round(-degrees / 90) % 4) + 4) % 4
}

/** Rotate by whole quarter turns, clockwise. */
export function rotateQuarter(image: ImageBitmap, turns: number): ImageBitmap {
  const sideways = turns % 2 === 1
  const canvas = new OffscreenCanvas(
    sideways ? image.height : image.width,
    sideways ? image.width : image.height,
  )
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(image, -image.width / 2, -image.height / 2)
  return canvas.transferToImageBitmap()
}

/**
 * Find the faces, turning the photo upright first when its pixels are rotated
 * (a photo with no orientation tag, or one rotated by hand).
 */
export async function detectUpright(
  image: ImageBitmap,
): Promise<{ image: ImageBitmap; faces: Landmark[][]; turns: number }> {
  let faces = await detectFaces(image)
  let turns = 0

  // the model does not find upside-down faces, so try that orientation explicitly
  if (faces.length === 0) {
    const flipped = rotateQuarter(image, 2)
    const flippedFaces = await detectFaces(flipped)
    if (flippedFaces.length === 0) return { image, faces, turns }
    image = flipped
    faces = flippedFaces
    turns = 2
  }

  const more = quarterTurns(faceGeometry(faces[0], image.width, image.height))
  if (more === 0) return { image, faces, turns }

  const upright = rotateQuarter(image, more)
  return { image: upright, faces: await detectFaces(upright), turns: (turns + more) % 4 }
}
