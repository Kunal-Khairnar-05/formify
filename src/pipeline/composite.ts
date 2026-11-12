/** Step 4: person over a flat background colour, using the mask as alpha. */
export function composite(image: ImageBitmap, mask: Float32Array, background: string): ImageData {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // let the canvas turn any CSS colour ('#fff', 'white', 'rgb(...)') into RGB bytes
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1, 1)
  const [bgR, bgG, bgB] = ctx.getImageData(0, 0, 1, 1).data

  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, image.width, image.height)
  const data = pixels.data

  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i] // 1 = person, 0 = background
    const o = i * 4
    data[o] = data[o] * alpha + bgR * (1 - alpha)
    data[o + 1] = data[o + 1] * alpha + bgG * (1 - alpha)
    data[o + 2] = data[o + 2] * alpha + bgB * (1 - alpha)
    data[o + 3] = 255
  }
  return pixels
}