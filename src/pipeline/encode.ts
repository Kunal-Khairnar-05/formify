import encode from '@jsquash/jpeg/encode'

/** Step 7a: MozJPEG (WebAssembly) at the given quality, as a baseline JPEG. */
export async function encodeJpeg(pixels: ImageData, quality: number): Promise<Uint8Array> {
  // baseline, not progressive: some older portal validators mishandle progressive files
  const buffer = await encode(pixels, { quality, baseline: true, progressive: false })
  return new Uint8Array(buffer)
}
