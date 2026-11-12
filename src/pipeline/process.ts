import { composite } from './composite'
import { cropBox } from './crop'
import { exportJpeg, type Exported } from './exportJpeg'
import { faceGeometry } from './faceGeometry'
import { loadImage } from './loadImage'
import { hairTop, keepConnected, sharpenMask } from './mask'
import { detectUpright } from './orient'
import { cropAndResize } from './resize'
import { segment } from './segment'
import type { FaceGeometry, Rect, Spec } from './types'

export interface Processed {
  /** The photo after loading and turning upright. */
  image: ImageBitmap
  /** Clockwise quarter turns applied to make the face upright. */
  turns: number
  faceCount: number
  /** Present only when exactly one face was found. */
  stages?: {
    face: FaceGeometry
    mask: Float32Array
    box: Rect
    final: ImageData
    /** null when the spec's size limit cannot be met. */
    exported: Exported | null
    /** Things about the source photo that may get the result rejected. */
    warnings: string[]
  }
  timingsMs: Record<string, number>
}

/** The whole pipeline: file in, spec-sized JPEG out, with every intermediate stage kept. */
export async function processPhoto(file: Blob, spec: Spec): Promise<Processed> {
  const timingsMs: Record<string, number> = {}
  let mark = performance.now()
  const lap = (name: string) => {
    const now = performance.now()
    timingsMs[name] = Math.round(now - mark)
    mark = now
  }

  const loaded = await loadImage(file)
  lap('load')

  const { image, faces, turns } = await detectUpright(loaded)
  lap('faces')
  if (faces.length !== 1) return { image, turns, faceCount: faces.length, timingsMs }

  const meshFace = faceGeometry(faces[0], image.width, image.height)
  const rawMask = await segment(image)
  lap('segment')

  // drop the haze, then anything not attached to this person
  const faceCentre = {
    x: (meshFace.leftEye.x + meshFace.rightEye.x) / 2,
    y: (meshFace.leftEye.y + meshFace.chin.y) / 2,
  }
  const mask = keepConnected(sharpenMask(rawMask), image.width, image.height, faceCentre)

  // the mesh stops at the hairline; the mask knows where the hair really ends
  const face: FaceGeometry = {
    ...meshFace,
    crown: { x: meshFace.crown.x, y: hairTop(mask, image.width, meshFace) },
  }
  const box = cropBox(face, image.width, image.height, spec.widthPx / spec.heightPx)
  const pixels = composite(image, mask, spec.background)
  const final = await cropAndResize(pixels, box, spec.widthPx, spec.heightPx, spec.background)
  lap('mask, crop, resize')

  const warnings: string[] = []
  if (box.width < spec.widthPx) {
    warnings.push(
      `Low resolution: the crop is ${box.width} x ${box.height} px but the form needs ` +
        `${spec.widthPx} x ${spec.heightPx} px, so the result is enlarged and will look soft.`,
    )
  }
  if (face.crown.y === 0) {
    warnings.push('The top of the head is cut off in this photo.')
  }

  const exported = await exportJpeg(final, spec)
  lap('encode')

  return {
    image,
    turns,
    faceCount: 1,
    stages: { face, mask, box, final, exported, warnings },
    timingsMs,
  }
}
