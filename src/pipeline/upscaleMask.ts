/** Scale a mask of values in [0, 1] from width x height up to toWidth x toHeight, smoothly. */
export function upscaleMask(
  values: Float32Array,
  width: number,
  height: number,
  toWidth: number,
  toHeight: number,
): Float32Array {
  // the mask rides in the red channel so the canvas can do the interpolation
  const small = new OffscreenCanvas(width, height)
  const pixels = new ImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    pixels.data[i * 4] = Math.round(Math.min(1, Math.max(0, values[i])) * 255)
    pixels.data[i * 4 + 3] = 255
  }
  small.getContext('2d')!.putImageData(pixels, 0, 0)

  const full = new OffscreenCanvas(toWidth, toHeight)
  const ctx = full.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, toWidth, toHeight)
  const scaled = ctx.getImageData(0, 0, toWidth, toHeight).data

  const mask = new Float32Array(toWidth * toHeight)
  for (let i = 0; i < mask.length; i++) mask[i] = scaled[i * 4] / 255
  return mask
}
