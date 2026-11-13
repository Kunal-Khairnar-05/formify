// Turning the ink mask into outlines: closed curves that follow the edge of every stroke.
// A drawing made of curves has no pixels, so it stays sharp at any size.

export type Point = [x: number, y: number]

// the mask value that counts as the edge of the ink
const LEVEL = 0.5

/**
 * Find the outlines of everything above LEVEL in a 0..1 map, by marching squares.
 *
 * The map is walked one 2 x 2 block of neighbouring values at a time. Which of the four
 * corners are ink says where the edge crosses the block, and how far along each side it
 * crosses comes from the two values on that side: a value just over LEVEL puts the edge
 * near that corner. That is what places the outline between pixels, not on them.
 *
 * Outside the map counts as paper, so every outline closes. Returns one list of points per
 * closed outline, in pixel units with (0, 0) at the top-left corner of the map.
 */
export function outlines(mask: Float32Array, width: number, height: number): Point[][] {
  const value = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]

  // Every crossing lies on the side shared by two blocks, so each one gets a number that
  // both blocks agree on: the side's first corner, and whether it runs across or down.
  const stride = width + 2
  const across = (x: number, y: number) => ((y + 1) * stride + (x + 1)) * 2
  const down = (x: number, y: number) => ((y + 1) * stride + (x + 1)) * 2 + 1

  const position = new Map<number, Point>()
  const links = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    links.set(a, [...(links.get(a) ?? []), b])
    links.set(b, [...(links.get(b) ?? []), a])
  }
  // how far from the first value to the second the edge lies
  const between = (first: number, second: number) => (LEVEL - first) / (second - first)

  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const tl = value(x, y)
      const tr = value(x + 1, y)
      const br = value(x + 1, y + 1)
      const bl = value(x, y + 1)
      const kind =
        (tl >= LEVEL ? 8 : 0) | (tr >= LEVEL ? 4 : 0) | (br >= LEVEL ? 2 : 0) | (bl >= LEVEL ? 1 : 0)
      if (kind === 0 || kind === 15) continue

      // the crossing on each side of the block; values sit at pixel centres, hence the half
      const top = across(x, y)
      const bottom = across(x, y + 1)
      const left = down(x, y)
      const right = down(x + 1, y)
      if (tl >= LEVEL !== tr >= LEVEL) position.set(top, [x + 0.5 + between(tl, tr), y + 0.5])
      if (bl >= LEVEL !== br >= LEVEL) position.set(bottom, [x + 0.5 + between(bl, br), y + 1.5])
      if (tl >= LEVEL !== bl >= LEVEL) position.set(left, [x + 0.5, y + 0.5 + between(tl, bl)])
      if (tr >= LEVEL !== br >= LEVEL) position.set(right, [x + 1.5, y + 0.5 + between(tr, br)])

      switch (kind) {
        case 1:
        case 14:
          link(left, bottom)
          break
        case 2:
        case 13:
          link(bottom, right)
          break
        case 3:
        case 12:
          link(left, right)
          break
        case 4:
        case 11:
          link(top, right)
          break
        case 6:
        case 9:
          link(top, bottom)
          break
        case 7:
        case 8:
          link(top, left)
          break
        default: {
          // two opposite corners are ink: the middle decides whether they are one stroke
          const joined = (tl + tr + br + bl) / 4 >= LEVEL
          // kind 5: top-right and bottom-left are ink; kind 10: the other two
          if ((kind === 5) === joined) {
            link(top, left)
            link(bottom, right)
          } else {
            link(top, right)
            link(left, bottom)
          }
        }
      }
    }
  }

  // follow the links from crossing to crossing until each outline comes back to its start
  const loops: Point[][] = []
  const seen = new Set<number>()
  for (const start of links.keys()) {
    if (seen.has(start)) continue
    const loop: Point[] = []
    let previous = -1
    let current = start
    while (!seen.has(current)) {
      seen.add(current)
      loop.push(position.get(current)!)
      const [a, b] = links.get(current)!
      const next = a !== previous && !seen.has(a) ? a : b
      previous = current
      current = next ?? start
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** The area inside a closed outline, in square pixels. */
export function area(loop: Point[]): number {
  let twice = 0
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i]
    const [x2, y2] = loop[(i + 1) % loop.length]
    twice += x1 * y2 - x2 * y1
  }
  return Math.abs(twice) / 2
}

// how far point p is from the straight line through a and b
function distance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length
}

/**
 * Drop the points an open run of points does not need (Ramer-Douglas-Peucker): keep the two
 * ends, find the point furthest from the straight line between them, and if it is further
 * than `tolerance` keep it and do the same on each side of it.
 */
function thin(points: Point[], tolerance: number): Point[] {
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [from, to] = stack.pop()!
    let furthest = -1
    let most = tolerance
    for (let i = from + 1; i < to; i++) {
      const d = distance(points[i], points[from], points[to])
      if (d > most) {
        most = d
        furthest = i
      }
    }
    if (furthest !== -1) {
      keep[furthest] = 1
      stack.push([from, furthest], [furthest, to])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/**
 * The same closed outline with fewer points: none of the dropped points was further than
 * `tolerance` pixels from the simpler shape. Marching squares gives a point for every pixel
 * the edge passes; a smooth stroke needs far fewer.
 */
export function simplify(loop: Point[], tolerance: number): Point[] {
  if (loop.length <= 4) return loop
  // a closed outline has no ends, so it is cut at two points far apart and each half thinned
  let far = 0
  let most = 0
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1])
    if (d > most) {
      most = d
      far = i
    }
  }
  const first = thin(loop.slice(0, far + 1), tolerance)
  const second = thin([...loop.slice(far), loop[0]], tolerance)
  // each half ends where the other begins
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

const text = (n: number) => String(Math.round(n * 100) / 100)

/**
 * One closed outline as SVG path commands, as a smooth curve through its points. Each piece
 * is a cubic Bezier whose handles point along the line between the neighbours on either
 * side (a Catmull-Rom spline), so the curve passes through every point without corners.
 */
export function pathData(loop: Point[]): string {
  const n = loop.length
  const at = (i: number) => loop[((i % n) + n) % n]
  let d = `M${text(loop[0][0])} ${text(loop[0][1])}`
  for (let i = 0; i < n; i++) {
    const [before, from, to, after] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1: Point = [from[0] + (to[0] - before[0]) / 6, from[1] + (to[1] - before[1]) / 6]
    const c2: Point = [to[0] - (after[0] - from[0]) / 6, to[1] - (after[1] - from[1]) / 6]
    d += `C${text(c1[0])} ${text(c1[1])} ${text(c2[0])} ${text(c2[1])} ${text(to[0])} ${text(to[1])}`
  }
  return `${d}Z`
}
