import type { Rect } from './types'

/** Step 6: cut `box` out of the pixels and scale it to exactly width x height. */
export async function cropAndResize(
  pixels: ImageData,
  box: Rect,
  width: number,
  height: number,
): Promise<ImageData> {
  const scaled = await createImageBitmap(pixels, box.x, box.y, box.width, box.height, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  })
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(scaled, 0, 0)
  scaled.close()
  return ctx.getImageData(0, 0, width, height)
}
