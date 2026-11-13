/** Step 1: file -> upright bitmap, downscaled to a working size. */
export async function loadImage(file: Blob | ImageBitmap, maxEdge = 1536): Promise<ImageBitmap> {
  // 'from-image' applies the EXIF rotation, so a sideways phone photo comes out upright
  const full = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const longest = Math.max(full.width, full.height)
  if (longest <= maxEdge) return full

  const scale = maxEdge / longest
  const small = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * scale),
    resizeHeight: Math.round(full.height * scale),
    resizeQuality: 'high',
  })
  full.close()
  return small
}