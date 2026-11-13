import { regionToPixels, type Region } from '../crop/region'

/** Cut the user's chosen region out of the photo at full resolution, before any downscaling. */
export async function cropSource(file: Blob, region: Region): Promise<ImageBitmap> {
  // apply the EXIF rotation first: the region was drawn on the photo as the user sees it
  const full = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { x, y, width, height } = regionToPixels(region, full.width, full.height)
  const cropped = await createImageBitmap(full, x, y, width, height)
  full.close()
  return cropped
}
