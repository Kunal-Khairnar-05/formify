import { getSegmentationSession, ort } from './ort'

const SIZE = 320
// ImageNet statistics the model was trained with, per RGB channel
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/** Step 3b: image -> person mask, one value in [0, 1] per pixel of the image. */
export async function segment(image: ImageBitmap): Promise<Float32Array> {
  // 1. Preprocess: squash to the model's 320 x 320 input and read the RGBA bytes
  const small = new OffscreenCanvas(SIZE, SIZE)
  const smallCtx = small.getContext('2d', { willReadFrequently: true })!
  smallCtx.drawImage(image, 0, 0, SIZE, SIZE)
  const rgba = smallCtx.getImageData(0, 0, SIZE, SIZE).data

  // canvas gives RGBA per pixel (HWC); the model wants all R, then all G, then all B (CHW)
  const plane = SIZE * SIZE
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * plane + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c]
    }
  }

  // 2. Inference
  const session = await getSegmentationSession()
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) }
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]].data as Float32Array

  // 3. Postprocess: stretch the output to the full 0..1 range
  let min = Infinity
  let max = -Infinity
  for (const v of output) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1

  // write the 320 x 320 mask into the red channel, then let the canvas scale it up smoothly
  const maskPixels = new ImageData(SIZE, SIZE)
  for (let i = 0; i < plane; i++) {
    maskPixels.data[i * 4] = Math.round(((output[i] - min) / range) * 255)
    maskPixels.data[i * 4 + 3] = 255
  }
  smallCtx.putImageData(maskPixels, 0, 0)

  const full = new OffscreenCanvas(image.width, image.height)
  const fullCtx = full.getContext('2d', { willReadFrequently: true })!
  fullCtx.imageSmoothingQuality = 'high'
  fullCtx.drawImage(small, 0, 0, image.width, image.height)
  const scaled = fullCtx.getImageData(0, 0, image.width, image.height).data

  const mask = new Float32Array(image.width * image.height)
  for (let i = 0; i < mask.length; i++) mask[i] = scaled[i * 4] / 255
  return mask
}