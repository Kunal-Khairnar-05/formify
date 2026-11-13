import type { Rect } from './types'

// the main face must cover at least this many times the area of any other face;
// closer than that and the photo really does show two people
const DOMINANCE = 2

/**
 * Which face the photo is of, when more than one was found: the largest, as long as it is
 * clearly larger than every other. A neighbour at the edge of a selfie or a face on a poster
 * behind is much smaller than the subject. Returns the index, or null when there is no face
 * or no clear main one.
 */
export function pickMainFace(boxes: Rect[]): number | null {
  if (boxes.length === 0) return null

  const areas = boxes.map((box) => box.width * box.height)
  let main = 0
  for (let i = 1; i < areas.length; i++) if (areas[i] > areas[main]) main = i

  for (let i = 0; i < areas.length; i++) {
    if (i !== main && areas[main] < areas[i] * DOMINANCE) return null
  }
  return main
}
