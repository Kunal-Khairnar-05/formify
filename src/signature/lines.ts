// how far a ruled line may drift up or down and still be followed, as a fraction of the width;
// this is what lets a line that is a few degrees off level be found
const DRIFT = 0.004
// a ruled line is dark along at least this fraction of the width without a break
const LONG_RUN = 0.08
// on its own row, a piece of line runs at least this far; a pen stroke crossing it does not
const SHORT_RUN = 0.02

/** Swap rows and columns, so the same code can look for vertical lines. */
function transpose(values: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(values.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) out[x * height + y] = values[y * width + x]
  }
  return out
}

/** Mark the pixels that sit in a horizontal run of set pixels at least `minLength` long. */
function longRuns(bits: Uint8Array, width: number, height: number, minLength: number): Uint8Array {
  const out = new Uint8Array(bits.length)
  for (let y = 0; y < height; y++) {
    let start = -1
    for (let x = 0; x <= width; x++) {
      const set = x < width && bits[y * width + x] === 1
      if (set && start === -1) start = x
      if (!set && start !== -1) {
        if (x - start >= minLength) out.fill(1, y * width + start, y * width + x)
        start = -1
      }
    }
  }
  return out
}

/** Set every pixel that has a set pixel within `reach` rows above or below it. */
function spreadRows(bits: Uint8Array, width: number, height: number, reach: number): Uint8Array {
  const out = new Uint8Array(bits.length)
  for (let y = 0; y < height; y++) {
    const from = Math.max(0, y - reach)
    const to = Math.min(height - 1, y + reach)
    for (let x = 0; x < width; x++) {
      for (let k = from; k <= to; k++) {
        if (bits[k * width + x] === 1) {
          out[y * width + x] = 1
          break
        }
      }
    }
  }
  return out
}

/** Keep only the set pixels that connect, through other set pixels, to the left or right edge. */
function fromSides(bits: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(bits.length)
  const stack: number[] = []
  const visit = (index: number) => {
    if (bits[index] === 1 && out[index] === 0) {
      out[index] = 1
      stack.push(index)
    }
  }
  for (let y = 0; y < height; y++) {
    visit(y * width)
    visit(y * width + width - 1)
  }
  while (stack.length > 0) {
    const index = stack.pop()!
    const x = index % width
    const y = (index - x) / width
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) visit(ny * width + nx)
      }
    }
  }
  return out
}

/** Clear the ruled lines that run from side to side. */
function dropAcross(dark: Float32Array, width: number, height: number, contrast: number): Float32Array {
  const drift = Math.max(2, Math.round(width * DRIFT))
  // a ruled line is thin; anything taller at that spot is a pen stroke on or across the line
  const thickest = drift + 1

  const isDark = new Uint8Array(dark.length)
  for (let i = 0; i < dark.length; i++) isDark[i] = dark[i] > contrast ? 1 : 0

  // a band around everything dark: inside it a tilted line reads as one unbroken run
  const band = spreadRows(isDark, width, height, drift)
  // ruled lines: long runs that reach the side of the picture, which handwriting does not
  const lines = fromSides(longRuns(band, width, height, Math.round(width * LONG_RUN)), width, height)
  // within those, only pixels that are part of a level run; one row of slack, because a
  // tilted line steps from row to row and its soft edge pixels drop out
  const level = longRuns(
    spreadRows(isDark, width, height, 1),
    width,
    height,
    Math.max(3, Math.round(width * SHORT_RUN)),
  )

  const out = new Float32Array(dark)
  for (let x = 0; x < width; x++) {
    let start = -1
    for (let y = 0; y <= height; y++) {
      const set = y < height && isDark[y * width + x] === 1
      if (set && start === -1) start = y
      if (!set && start !== -1) {
        // a short vertical run: thin enough to be line rather than stroke
        if (y - start <= thickest) {
          for (let k = start; k < y; k++) {
            const index = k * width + x
            if (lines[index] === 1 && level[index] === 1) out[index] = 0
          }
        }
        start = -1
      }
    }
  }
  return out
}

/**
 * Clear the ruled and margin lines of the paper out of a darkness map, leaving the pen strokes.
 * A line is told from handwriting by three things together: it is long and unbroken, it runs
 * off the side of the picture, and it is thin. Where a stroke lies on a line, that piece of
 * the line stays, because the two cannot be told apart there.
 */
export function dropLines(
  dark: Float32Array,
  width: number,
  height: number,
  contrast: number,
): Float32Array {
  const across = dropAcross(dark, width, height, contrast)
  // the same again for lines running top to bottom, by turning the picture on its side
  const turned = dropAcross(transpose(across, width, height), height, width, contrast)
  return transpose(turned, height, width)
}

// a leftover piece of ruled line is at most this long, as a fraction of the longer side;
// a straight underline in a signature is longer and is kept
const FRAGMENT = 0.06
// groups of this many pixels or fewer are camera noise
const SPECK = 6

/**
 * Clear what line removal leaves behind: specks, and short flat or upright slivers where a
 * tilted line broke into pieces. Works on connected groups of ink, so a real stroke, which
 * is part of something larger or is not a thin straight sliver, is left alone.
 */
export function dropFragments(mask: Float32Array, width: number, height: number): Float32Array {
  const thin = Math.max(2, Math.round(width * DRIFT)) + 1
  const longest = Math.round(Math.max(width, height) * FRAGMENT)

  const out = new Float32Array(mask)
  const seen = new Uint8Array(mask.length)
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] <= 0.5 || seen[start] === 1) continue

    // collect one connected group and its bounding box
    const group = [start]
    seen[start] = 1
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    for (let next = 0; next < group.length; next++) {
      const index = group[next]
      const x = index % width
      const y = (index - x) / width
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const neighbour = ny * width + nx
          if (mask[neighbour] > 0.5 && seen[neighbour] === 0) {
            seen[neighbour] = 1
            group.push(neighbour)
          }
        }
      }
    }

    const across = maxX - minX + 1
    const down = maxY - minY + 1
    const short = Math.min(across, down)
    const long = Math.max(across, down)
    // thin, at least three times as long as it is thick, and too short to be an underline
    const sliver = short <= thin && long >= 3 * short && long <= longest
    if (group.length <= SPECK || sliver) {
      // clear the group with a one-pixel rim, which holds its soft edge
      for (const index of group) {
        const x = index % width
        const y = (index - x) / width
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) out[ny * width + nx] = 0
          }
        }
      }
    }
  }
  return out
}
