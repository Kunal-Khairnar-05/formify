import { getMatteSession, loadOrt } from './ort'
import { upscaleMask } from './upscaleMask'

// MODNet wants the shorter side at 512 px and both sides as multiples of 32
const SHORT_SIDE = 512
const STRIDE = 32

/** image -> soft alpha matte from MODNet, one value in [0, 1] per pixel of the image. */
export async function matte(image: ImageBitmap): Promise<Float32Array> {
  // 1. Preprocess: keep the aspect ratio, snap each side to the stride
  const scale = SHORT_SIDE / Math.min(image.width, image.height)
  const width = Math.max(STRIDE, Math.round((image.width * scale) / STRIDE) * STRIDE)
  const height = Math.max(STRIDE, Math.round((image.height * scale) / STRIDE) * STRIDE)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, width, height)
  const rgba = ctx.getImageData(0, 0, width, height).data

  // HWC bytes -> CHW floats in [-1, 1]
  const plane = width * height
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * plane + i] = (rgba[i * 4 + c] / 255 - 0.5) / 0.5
    }
  }

  // 2. Inference
  const [ort, session] = await Promise.all([loadOrt(), getMatteSession()])
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, height, width]) }
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]].data as Float32Array

  // 3. Postprocess: the output is already an alpha matte in [0, 1]; only scale it back up
  return upscaleMask(output, width, height, image.width, image.height)
}