import { composite } from './composite'
import { cropBox } from './crop'
import { softenEdge } from './edge'
import { exportJpeg, type Exported } from './exportJpeg'
import { faceGeometry } from './faceGeometry'
import { dilate, limitTo, softOutside } from './gate'
import type { Region } from '../crop/region'
import { loadImage } from './loadImage'
import { pickMainFace } from './mainFace'
import { hairTop, keepConnected, sharpenMask } from './mask'
import { matte } from './matte'
import { detectUpright } from './orient'
import { cropSource } from './precrop'
import { cropAndResize } from './resize'
import { segment } from './segment'
import { measureFace, sourceWarnings } from './sourceWarnings'
import type { FaceGeometry, Rect, Spec } from './types'

// how far the "who" mask is grown before it limits the matte, as a fraction of image width;
// wide enough to keep loose hair, narrow enough to exclude a neighbour
const GATE_GROWTH = 0.015

// how far the fast path pulls the edge in and feathers it, as a fraction of image width
const EDGE_SOFTEN = 0.003

/**
 * fast: U²-Net only, with a softened edge. The default.
 * fine: adds MODNet for loose hair. Costs a 26 MB model download and about a second more.
 */
export type Quality = 'fast' | 'fine'

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
export async function processPhoto(
  file: Blob,
  spec: Spec,
  quality: Quality = 'fast',
  /** Part of the photo to use, chosen by the user; the whole photo when left out. */
  region?: Region,
  /** Told what is about to start, in words for the user; awaited so the page can show it. */
  onStage?: (stage: string) => void | Promise<void>,
): Promise<Processed> {
  const timingsMs: Record<string, number> = {}
  let mark = performance.now()
  const lap = (name: string) => {
    const now = performance.now()
    timingsMs[name] = Math.round(now - mark)
    mark = now
  }

  await onStage?.('Reading your photo')
  const loaded = await loadImage(region ? await cropSource(file, region) : file)
  lap('load')

  await onStage?.('Finding your face')
  const { image, faces, turns } = await detectUpright(loaded)
  lap('faces')
  // several faces are fine when one is clearly the subject: a neighbour at the edge of a
  // selfie is dropped later, with everything else that is not attached to this person
  const geometries = faces.map((face) => faceGeometry(face, image.width, image.height))
  const main = pickMainFace(geometries.map((geometry) => geometry.box))
  if (main === null) return { image, turns, faceCount: faces.length, timingsMs }

  const meshFace = geometries[main]
  await onStage?.('Removing the background')
  const rawMask = await segment(image)
  lap('segment')

  // who: drop the haze, then anything not attached to this person
  const faceCentre = {
    x: (meshFace.leftEye.x + meshFace.rightEye.x) / 2,
    y: (meshFace.leftEye.y + meshFace.chin.y) / 2,
  }
  const who = keepConnected(sharpenMask(rawMask), image.width, image.height, faceCentre)

  let mask: Float32Array
  if (quality === 'fast') {
    // pull the edge in off the background and feather it; no second model
    const radius = Math.max(1, Math.round(image.width * EDGE_SOFTEN))
    mask = softenEdge(who, image.width, image.height, radius)
  } else {
    // where the edge is: MODNet's soft matte, which keeps hair detail but also every
    // other person in the frame, so it is limited to a slightly grown copy of "who"
    await onStage?.('Refining the hair edges')
    const alpha = await matte(image)
    lap('matte')
    const gate = dilate(who, image.width, image.height, Math.round(image.width * GATE_GROWTH))
    // in the grown band only soft matte (loose hair) is wanted; anything solid out there
    // is a neighbour or an object touching the person
    mask = softOutside(limitTo(alpha, gate), who, image.width, image.height)
  }

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
  if (faces.length > 1) {
    warnings.push(
      'More than one face is in the photo. The largest one was used; check that the result ' +
        'shows only you.',
    )
  }
  if (box.width < spec.widthPx) {
    warnings.push(
      `Low resolution: the crop is ${box.width} x ${box.height} px but the form needs ` +
        `${spec.widthPx} x ${spec.heightPx} px, so the result is enlarged and will look soft.`,
    )
  }
  if (face.crown.y === 0) {
    warnings.push('The top of the head is cut off in this photo.')
  }
  if (box.x < 0 || box.x + box.width > image.width) {
    warnings.push(
      'There is not enough room beside the head in this photo or crop, so part of the result ' +
        'is filled with the background colour. Use a wider crop or a photo taken from further away.',
    )
  }

  // the lean, light and sharpness of the face as photographed
  warnings.push(...sourceWarnings(measureFace(image, face)))
  lap('checks')

  await onStage?.('Fitting the file size')
  const exported = await exportJpeg(final, spec)
  lap('encode')

  return {
    image,
    turns,
    faceCount: faces.length,
    stages: { face, mask, box, final, exported, warnings },
    timingsMs,
  }
}
