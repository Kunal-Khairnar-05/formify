import type { Rect } from './types'

/**
 * Step 6: cut `box` out of the pixels and scale it to exactly width x height.
 * Any part of the box that lies outside the image is filled with `background`.
 */
export async function cropAndResize(
  pixels: ImageData,
  box: Rect,
  width: number,
  height: number,
  background: string,
): Promise<ImageData> {
  // the box at its own size, background first, then the image shifted into place
  const cut = new OffscreenCanvas(box.width, box.height)
  const cutCtx = cut.getContext('2d')!
  cutCtx.fillStyle = background
  cutCtx.fillRect(0, 0, box.width, box.height)
  cutCtx.putImageData(pixels, -box.x, -box.y)

  const scaled = await createImageBitmap(cut, {
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
