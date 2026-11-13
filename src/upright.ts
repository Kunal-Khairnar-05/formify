import { loadImage } from './pipeline/loadImage'
import { detectUpright, rotateQuarter } from './pipeline/orient'
import { guessSignatureTurns } from './signature/process'

// rotating means storing the picture again; at this quality the loss cannot be seen
const RESAVE_QUALITY = 0.97

/** Turn a picture file by whole quarter turns, clockwise, at its full size. */
export async function rotateFile(file: Blob, turns: number): Promise<Blob> {
  if (turns % 4 === 0) return file
  // 'from-image' applies the EXIF rotation first, so the turn is from what the user sees
  const full = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const turned = rotateQuarter(full, turns)
  full.close()
  const canvas = new OffscreenCanvas(turned.width, turned.height)
  canvas.getContext('2d')!.drawImage(turned, 0, 0)
  turned.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality: RESAVE_QUALITY })
}

/**
 * How many clockwise quarter turns make the picture upright: from the face for a photo,
 * from the shape of the ink for a signature. 0 when it cannot tell.
 */
export async function guessTurns(file: Blob, kind: 'photo' | 'signature'): Promise<number> {
  if (kind === 'signature') return guessSignatureTurns(file)
  const { turns } = await detectUpright(await loadImage(file))
  return turns
}
