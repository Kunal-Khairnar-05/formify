import { describe, expect, it } from 'vitest'
import {
  checkSpec,
  cropCaution,
  resolveChecked,
  smallestJpeg,
  typicalPhotoJpeg,
  type Kind,
} from './feasibility'
import type { SpecInput } from './units'

const input = (change: Partial<SpecInput> = {}): SpecInput => ({
  width: 3.5,
  height: 4.5,
  unit: 'cm',
  dpi: 300,
  maxKb: 50,
  background: '#ffffff',
  ...change,
})

const check = (change: Partial<SpecInput> = {}, kind: Kind = 'photo') =>
  resolveChecked(input(change), kind)
const errors = (result: ReturnType<typeof check>) => (result.ok ? [] : result.errors)
const cautions = (result: ReturnType<typeof check>) => (result.ok ? result.cautions : [])

describe('smallestJpeg', () => {
  it('stays under every blank picture that was measured', () => {
    // pixels, bytes of a blank JPG at the lowest quality, from the app's encoder
    for (const [pixels, measured] of [
      [100 * 120, 351],
      [200 * 230, 560],
      [413 * 531, 1593],
      [826 * 1062, 5493],
      [1600 * 2057, 19617],
    ]) {
      expect(smallestJpeg(pixels)).toBeLessThan(measured)
      // and not so far under that it would let through what cannot fit
      expect(smallestJpeg(pixels)).toBeGreaterThan(measured * 0.7)
    }
  })
})

describe('typicalPhotoJpeg', () => {
  it('is within a quarter of the test photo at every size measured', () => {
    for (const [pixels, measured] of [
      [100 * 120, 1313],
      [200 * 230, 2909],
      [413 * 531, 8764],
      [826 * 1062, 23103],
      [1600 * 2057, 60380],
    ]) {
      expect(typicalPhotoJpeg(pixels)).toBeGreaterThan(measured * 0.75)
      expect(typicalPhotoJpeg(pixels)).toBeLessThan(measured * 1.25)
    }
  })
})

describe('resolveChecked', () => {
  it('passes the usual photo and signature details with nothing to say', () => {
    expect(check()).toMatchObject({ ok: true, cautions: [] })
    const signature = check({ width: 140, height: 60, unit: 'px', minKb: 10, maxKb: 20 }, 'signature')
    expect(signature).toMatchObject({ ok: true, cautions: [] })
  })

  it('still reports what resolveSpec reports', () => {
    expect(errors(check({ width: Number.NaN }))).toEqual(['Width must be a number above 0.'])
  })

  it('refuses fractions of a pixel', () => {
    expect(errors(check({ width: 200.5, height: 230, unit: 'px' }))[0]).toContain('whole numbers')
    expect(check({ width: 200, height: 230, unit: 'px' }).ok).toBe(true)
  })

  it('allows fractions in other units', () => {
    expect(check({ width: 3.5, height: 4.5, unit: 'cm' }).ok).toBe(true)
  })

  it('refuses limits that leave no size between them', () => {
    // at least 49 x 1024 = 50,176 bytes, at most 50 x 1000 = 50,000 bytes
    expect(errors(check({ minKb: 49, maxKb: 50 }))[0]).toContain('too close together')
  })

  it('allows a narrow range that still has room', () => {
    // 48 x 1024 = 49,152 bytes, under 50,000
    expect(check({ minKb: 48, maxKb: 50 }).ok).toBe(true)
  })

  it('refuses a limit that not even a blank picture of that size meets', () => {
    // 4000 x 4000 px blank is about 88 KB
    const result = check({ width: 4000, height: 4000, unit: 'px', maxKb: 20 })
    expect(errors(result)[0]).toContain('cannot fit in 20 KB')
  })

  it('cautions when the limit is very little for a photo of that size', () => {
    // 1200 x 1600 px: a blank is about 12 KB, a real photo needs about 43 KB
    const result = check({ width: 1200, height: 1600, unit: 'px', maxKb: 20 })
    expect(result.ok).toBe(true)
    expect(cautions(result)[0]).toContain('very little')
  })

  it('does not give that caution for a signature, which is mostly blank', () => {
    const result = check({ width: 1200, height: 400, unit: 'px', maxKb: 12 }, 'signature')
    expect(cautions(result)).toEqual([])
  })

  it('cautions about an unusual DPI, but not when the unit is pixels', () => {
    expect(cautions(check({ dpi: 30 }))[0]).toContain('30 DPI is unusual')
    expect(cautions(check({ dpi: 1200, maxKb: 2000 }))[0]).toContain('1200 DPI is unusual')
    expect(cautions(check({ width: 200, height: 230, unit: 'px', dpi: 5 }))).toEqual([])
  })

  it('cautions about a photo that is wider than tall', () => {
    expect(cautions(check({ width: 4.5, height: 3.5 }))[0]).toContain('wider than it is tall')
  })

  it('says nothing about a square photo', () => {
    expect(cautions(check({ width: 2, height: 2, unit: 'in', maxKb: 200 }))).toEqual([])
  })

  it('cautions about a signature that is taller than wide', () => {
    const result = check({ width: 60, height: 140, unit: 'px', maxKb: 20 }, 'signature')
    expect(cautions(result)[0]).toContain('taller than it is wide')
  })

  it('cautions about a very long shape', () => {
    expect(cautions(check({ width: 100, height: 600, unit: 'px' }))[0]).toContain('very long shape')
    const signature = check({ width: 900, height: 60, unit: 'px', maxKb: 20 }, 'signature')
    expect(cautions(signature)[0]).toContain('very long shape')
  })
})

describe('resolveChecked, for a PNG', () => {
  it('cautions that a PNG photo is far over a small limit and cannot be squeezed', () => {
    // 413 x 531 px as a PNG is about 240 KB
    const result = check({ format: 'png', maxKb: 50 })
    expect(result.ok).toBe(true)
    expect(cautions(result)[0]).toContain('PNG cannot be made smaller')
  })

  it('says nothing when the limit leaves room for a PNG photo', () => {
    expect(cautions(check({ format: 'png', maxKb: 500 }))).toEqual([])
  })

  it('says nothing about a PNG signature, which is small', () => {
    const result = check({ width: 140, height: 60, unit: 'px', format: 'png', maxKb: 20 }, 'signature')
    expect(result).toMatchObject({ ok: true, cautions: [] })
  })

  it('does not apply the JPG size checks to a PNG', () => {
    // as a JPG this would be refused: a blank 4000 x 4000 px JPG is about 88 KB
    const result = check({ width: 4000, height: 4000, unit: 'px', format: 'png', maxKb: 20 }, 'signature')
    expect(result.ok).toBe(true)
  })
})

describe('checkSpec', () => {
  it('gives every problem at once', () => {
    const spec = { widthPx: 4000, heightPx: 4000, minKb: 30, maxKb: 20, format: 'jpg' as const, background: '#fff' }
    const result = checkSpec(spec, input({ width: 4000, height: 4000, unit: 'px', minKb: 30, maxKb: 20 }), 'photo')
    expect(result.errors).toHaveLength(2)
  })
})

describe('cropCaution', () => {
  const spec = { widthPx: 413, heightPx: 531, format: 'jpg' as const, background: '#fff' }

  it('says nothing when the crop holds enough pixels', () => {
    expect(cropCaution(800, 1029, spec)).toBeNull()
  })

  it('allows a little enlargement', () => {
    expect(cropCaution(380, 489, spec)).toBeNull()
  })

  it('cautions when the crop is much smaller than the output, with how much', () => {
    expect(cropCaution(200, 257, spec)).toContain('about 2.1 times')
  })

  it('goes by the side that is shortest of what it needs', () => {
    // wide enough, but only half the height needed
    expect(cropCaution(800, 265, spec)).toContain('about 2.0 times')
  })
})
