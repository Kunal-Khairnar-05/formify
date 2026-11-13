// below this a mark is paper texture or camera noise, whatever else is in the photo
const MIN_CONTRAST = 0.08
// ink counts from this fraction of the darkest ink's darkness
const SHARE = 0.3
// the darkest ink is read here rather than at the single darkest pixel, which may be a speck
const PERCENTILE = 0.999
const BINS = 256

/**
 * The darkness at which a mark starts to count as ink, chosen from the photo itself.
 * Pen ink is far darker than the ruled lines or texture of the paper, so the cut is set
 * as a share of the darkest ink: lines that a fixed cut would let through fall below it.
 */
export function pickContrast(dark: Float32Array): number {
  const histogram = new Uint32Array(BINS)
  for (let i = 0; i < dark.length; i++) {
    histogram[Math.min(BINS - 1, Math.floor(dark[i] * BINS))]++
  }

  // walk up the histogram to the bin holding the 99.9th percentile
  const target = dark.length * PERCENTILE
  let seen = 0
  let bin = 0
  while (bin < BINS - 1 && seen + histogram[bin] < target) {
    seen += histogram[bin]
    bin++
  }
  const darkest = bin / BINS

  return Math.max(MIN_CONTRAST, darkest * SHARE)
}
