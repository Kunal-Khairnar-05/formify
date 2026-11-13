import { describe, expect, it } from 'vitest'
import { measure, validate } from '../pipeline/validate'
import type { Spec } from '../pipeline/types'
import { isSvg, padSvg, signatureSvg, svgSize } from './svg'

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

const spec: Spec = { widthPx: 140, heightPx: 60, format: 'svg', extension: 'svg', background: '#ffffff' }

// a 70 x 30 photo with a thick stroke and a ring in it; the whole photo becomes the picture
const WIDTH = 70
const HEIGHT = 30
function mask(): Float32Array {
  const values = new Float32Array(WIDTH * HEIGHT)
  const set = (x: number, y: number) => (values[y * WIDTH + x] = 1)
  for (let x = 5; x < 30; x++) for (let y = 12; y < 16; y++) set(x, y)
  for (let x = 40; x < 60; x++) {
    for (let y = 5; y < 25; y++) {
      const d = Math.hypot(x - 50, y - 15)
      if (d > 5 && d < 9) set(x, y)
    }
  }
  return values
}
const box = { x: 0, y: 0, width: WIDTH, height: HEIGHT }
const make = (maxBytes?: number) => signatureSvg(mask(), WIDTH, HEIGHT, box, spec, 'rgb(10,20,90)', maxBytes)

describe('signatureSvg', () => {
  it('writes an SVG at the size the form asks for', () => {
    const svg = text(make()!)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="60" viewBox="0 0 140 60">')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('draws the background, then the ink in one colour', () => {
    const svg = text(make()!)
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>')
    expect(svg).toContain('<path fill="rgb(10,20,90)" fill-rule="evenodd" d="M')
  })

  it('has one outline for the stroke and two for the ring', () => {
    const svg = text(make()!)
    expect(svg.match(/M/g)).toHaveLength(3)
    expect(svg.match(/Z/g)).toHaveLength(3)
  })

  it('scales the photo up to the output: no number falls outside the picture', () => {
    const d = /d="([^"]+)"/.exec(text(make()!))![1]
    const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    // curve handles may reach a little past the points, never far past the 140 x 60 picture
    expect(Math.min(...numbers)).toBeGreaterThan(-5)
    expect(Math.max(...numbers)).toBeLessThan(145)
    // and the drawing really uses the width: the ring is at the right
    expect(Math.max(...numbers)).toBeGreaterThan(110)
  })

  it('draws more simply to get under a maximum', () => {
    const full = make()!
    // this hard-edged test shape has little to give; a real, soft-edged signature has more
    const limit = Math.round(full.length * 0.9)
    const tight = make(limit)!
    expect(tight.length).toBeLessThanOrEqual(limit)
    expect(tight.length).toBeLessThan(full.length)
  })

  it('gives up when even the simplest drawing is too large', () => {
    expect(make(100)).toBeNull()
  })

  it('is measured and validated like any other file', () => {
    const bytes = make()!
    expect(measure(bytes)).toEqual({ widthPx: 140, heightPx: 60, bytes: bytes.length, format: 'svg' })
    expect(validate(bytes, spec)).toEqual([])
    expect(validate(bytes, { ...spec, widthPx: 200 })).toHaveLength(1)
  })

  it('leaves specks out', () => {
    const values = mask()
    values[2 * WIDTH + 2] = 1
    const withSpeck = signatureSvg(values, WIDTH, HEIGHT, box, spec, 'black')!
    expect(text(withSpeck).match(/M/g)).toHaveLength(3)
  })
})

describe('isSvg and svgSize', () => {
  it('knows this app\'s SVG and reads its size', () => {
    const bytes = make()!
    expect(isSvg(bytes)).toBe(true)
    expect(svgSize(bytes)).toEqual({ widthPx: 140, heightPx: 60 })
  })

  it('refuses other files', () => {
    expect(isSvg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(false)
    expect(isSvg(new Uint8Array(0))).toBe(false)
  })
})

describe('padSvg', () => {
  it('grows the file to exactly the size asked for, with a comment', () => {
    const bytes = make()!
    const padded = padSvg(bytes, 12_000)
    expect(padded).toHaveLength(12_000)
    expect(text(padded)).toMatch(/<!-- +--><\/svg>$/)
  })

  it('leaves the drawing as it was', () => {
    const bytes = make()!
    const padded = text(padSvg(bytes, 12_000))
    expect(padded.replace(/<!-- +-->/, '')).toBe(text(bytes))
    expect(measure(padSvg(bytes, 12_000))).toMatchObject({ widthPx: 140, heightPx: 60, format: 'svg' })
  })

  it('returns the input when it is already large enough, or is not an SVG', () => {
    const bytes = make()!
    expect(padSvg(bytes, 10)).toBe(bytes)
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0])
    expect(padSvg(jpeg, 100)).toBe(jpeg)
  })
})
