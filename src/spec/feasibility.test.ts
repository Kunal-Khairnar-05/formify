import { describe, expect, it } from 'vitest'
import {
  badFields,
  checkSpec,
  cropCaution,
  resolveChecked,
  smallestJpeg,
  suggest,
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

describe('resolveChecked, with the photo measured', () => {
  // the chosen photo at 413 x 531 px: 12 KB at the lowest quality, 76 KB at the best
  const measured = { smallestBytes: 12_000, bestBytes: 76_000 }
  const withPhoto = (change: Partial<SpecInput>) => resolveChecked(input(change), 'photo', measured)

  it('refuses a limit under half of what the photo weighs at the lowest quality', () => {
    // 5 KB leaves 4,750 bytes; half the mark is 6,000
    const result = withPhoto({ maxKb: 5 })
    expect(errors(result)[0]).toContain('5 KB cannot be met')
    expect(errors(result)[0]).toContain('needs about 6.3 KB or more')
  })

  it('cautions between half the mark and the whole mark', () => {
    const result = withPhoto({ maxKb: 10 })
    expect(result.ok).toBe(true)
    expect(cautions(result)[0]).toContain('10 KB is tight for this photo')
  })

  it('says nothing when the limit is above the mark', () => {
    expect(withPhoto({ maxKb: 50 })).toMatchObject({ ok: true, cautions: [] })
  })

  it('refuses a PNG limit under half of what the photo weighs as a PNG', () => {
    const png = { smallestBytes: 430_000, bestBytes: 430_000 }
    const result = resolveChecked(input({ format: 'png', maxKb: 50 }), 'photo', png)
    expect(errors(result)[0]).toContain('a PNG cannot be made smaller')
    expect(errors(result)[0]).toContain('Choose JPG')
  })

  it('does not use the photo measurement for a signature', () => {
    const result = resolveChecked(
      input({ width: 140, height: 60, unit: 'px', maxKb: 5 }),
      'signature',
      measured,
    )
    expect(result).toMatchObject({ ok: true, cautions: [] })
  })
})

describe('suggest', () => {
  const actions = (list: ReturnType<typeof suggest>) => list.map((item) => item.action)

  it('offers nothing for the usual details', () => {
    expect(suggest('photo', input())).toEqual([])
    expect(suggest('signature', input({ width: 140, height: 60, unit: 'px', minKb: 10, maxKb: 20 }))).toEqual([])
  })

  it('offers the nearest whole pixels', () => {
    const [first] = suggest('photo', input({ width: 200.5, height: 230.2, unit: 'px' }))
    expect(first.action).toBe('Use 201 x 230 px')
    expect(first.patch).toEqual({ width: '201', height: '230' })
  })

  it('offers the highest minimum that fits under the maximum', () => {
    // 50,000 bytes is 48.8 KB of 1024 bytes
    const [first] = suggest('photo', input({ minKb: 49, maxKb: 50 }))
    expect(first.patch).toEqual({ minKb: '48' })
  })

  it('offers a limit that works when the measured photo does not fit', () => {
    const list = suggest('photo', input({ maxKb: 5 }), undefined, { smallestBytes: 12_000, bestBytes: 76_000 })
    // 12,000 bytes needs 12.6 KB with the margin, rounded up
    expect(actions(list)).toEqual(['Set the maximum to 13 KB'])
  })

  it('offers JPG first when a PNG photo does not fit', () => {
    const list = suggest('photo', input({ format: 'png', maxKb: 50 }), undefined, {
      smallestBytes: 430_000,
      bestBytes: 430_000,
    })
    expect(actions(list)).toEqual(['Switch to JPG', 'Set the maximum to 430 KB'])
    expect(list[0].patch).toEqual({ format: 'jpg' })
  })

  it('offers a limit when none is set and the photo has been measured', () => {
    const list = suggest('photo', input({ maxKb: undefined }), undefined, {
      smallestBytes: 12_000,
      bestBytes: 76_000,
    })
    // 76,000 bytes needs 80 KB with the margin
    expect(actions(list)).toEqual(['Set the maximum to 80 KB'])
  })

  it('offers the most the chosen part can give without enlarging, in the same shape', () => {
    // the form needs 413 x 531 px; the chosen part is 233 x 300 px
    const list = suggest('photo', input(), { width: 233, height: 300 })
    expect(list[0].action).toBe('Use 233 x 299 px')
    expect(list[0].patch).toEqual({ width: '233', height: '299', unit: 'px' })
  })

  it('offers to swap a photo that is wider than tall, and a signature that is taller than wide', () => {
    expect(suggest('photo', input({ width: 4.5, height: 3.5 }))[0]).toMatchObject({
      action: 'Swap width and height',
      patch: { width: '3.5', height: '4.5' },
    })
    const signature = suggest('signature', input({ width: 60, height: 140, unit: 'px', maxKb: 20 }))
    expect(signature[0].patch).toEqual({ width: '140', height: '60' })
  })

  it('offers 300 DPI for an unusual DPI', () => {
    expect(actions(suggest('photo', input({ dpi: 30 })))).toContain('Use 300 DPI')
  })

  it('every offer, once applied, removes the problem it answers', () => {
    const cases: SpecInput[] = [
      input({ width: 200.5, height: 230, unit: 'px' }),
      input({ minKb: 49, maxKb: 50 }),
      input({ width: 4000, height: 4000, unit: 'px', maxKb: 20 }),
    ]
    for (const before of cases) {
      expect(resolveChecked(before, 'signature').ok).toBe(false)
      const [first] = suggest('signature', before)
      const number = (text: string | undefined, fallback: number | undefined) =>
        text === undefined ? fallback : Number(text)
      const after: SpecInput = {
        ...before,
        width: number(first.patch.width, before.width)!,
        height: number(first.patch.height, before.height)!,
        minKb: number(first.patch.minKb, before.minKb),
        maxKb: number(first.patch.maxKb, before.maxKb),
      }
      expect(resolveChecked(after, 'signature').ok).toBe(true)
    }
  })
})

describe('badFields', () => {
  const bad = (change: Partial<SpecInput>, kind: Kind = 'photo') => badFields(input(change), kind).sort()

  it('marks nothing when the request can be made', () => {
    expect(bad({})).toEqual([])
    // a caution is not an error
    expect(bad({ width: 4.5, height: 3.5 })).toEqual([])
  })

  it('marks an empty or negative size', () => {
    expect(bad({ width: Number.NaN })).toEqual(['width'])
    expect(bad({ height: -2 })).toEqual(['height'])
    expect(bad({ width: 0, height: 0 })).toEqual(['height', 'width'])
  })

  it('marks the DPI when a physical unit has none, but not for pixels', () => {
    expect(bad({ dpi: Number.NaN })).toEqual(['dpi'])
    expect(bad({ width: 200, height: 230, unit: 'px', dpi: Number.NaN })).toEqual([])
  })

  it('marks both limits when they are the wrong way round or too close', () => {
    expect(bad({ minKb: 60, maxKb: 50 })).toEqual(['maxKb', 'minKb'])
    expect(bad({ minKb: 49, maxKb: 50 })).toEqual(['maxKb', 'minKb'])
  })

  it('marks only the side that is a fraction of a pixel', () => {
    expect(bad({ width: 200.5, height: 230, unit: 'px' })).toEqual(['width'])
  })

  it('marks the side that comes out too small or too large', () => {
    // 0.1 cm at 300 DPI is 12 px
    expect(bad({ width: 0.1 })).toEqual(['width'])
    expect(bad({ width: 200, height: 5000, unit: 'px' })).toEqual(['height'])
  })

  it('marks the maximum when the size cannot fit in it', () => {
    expect(bad({ width: 4000, height: 4000, unit: 'px', maxKb: 20 })).toEqual(['maxKb'])
  })

  it('marks the maximum, and the file type for a PNG, when the measured photo cannot meet it', () => {
    const jpg = badFields(input({ maxKb: 5 }), 'photo', { smallestBytes: 12_000, bestBytes: 76_000 })
    expect(jpg).toEqual(['maxKb'])
    const png = badFields(input({ format: 'png', maxKb: 50 }), 'photo', {
      smallestBytes: 430_000,
      bestBytes: 430_000,
    })
    expect(png.sort()).toEqual(['format', 'maxKb'])
  })

  it('marks something whenever the request is refused', () => {
    const refused: Partial<SpecInput>[] = [
      { width: Number.NaN },
      { dpi: 0 },
      { minKb: 0 },
      { minKb: 49, maxKb: 50 },
      { width: 200.5, height: 230, unit: 'px' },
      { width: 9000, height: 100, unit: 'px' },
      { width: 4000, height: 4000, unit: 'px', maxKb: 20 },
    ]
    for (const change of refused) {
      expect(resolveChecked(input(change), 'photo').ok).toBe(false)
      expect(bad(change).length).toBeGreaterThan(0)
    }
  })
})
