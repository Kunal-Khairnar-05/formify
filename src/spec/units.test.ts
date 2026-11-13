import { describe, expect, it } from 'vitest'
import { resolveSpec, toPixels, type SpecInput } from './units'

const input = (over: Partial<SpecInput> = {}): SpecInput => ({
  width: 3.5,
  height: 4.5,
  unit: 'cm',
  dpi: 300,
  background: '#ffffff',
  ...over,
})

const errorsOf = (over: Partial<SpecInput>) => {
  const result = resolveSpec(input(over))
  return result.ok ? [] : result.errors
}

describe('toPixels', () => {
  it('converts centimetres', () => {
    expect(toPixels(3.5, 'cm', 300)).toBe(413)
    expect(toPixels(4.5, 'cm', 300)).toBe(531)
    expect(toPixels(2.54, 'cm', 96)).toBe(96)
  })

  it('converts millimetres the same as centimetres', () => {
    expect(toPixels(35, 'mm', 300)).toBe(413)
    expect(toPixels(45, 'mm', 300)).toBe(531)
  })

  it('converts inches', () => {
    expect(toPixels(2, 'in', 300)).toBe(600)
    expect(toPixels(1.5, 'in', 200)).toBe(300)
  })

  it('ignores DPI for pixels', () => {
    expect(toPixels(413, 'px', 300)).toBe(413)
    expect(toPixels(413, 'px', 0)).toBe(413)
  })

  it('rounds to whole pixels', () => {
    expect(toPixels(200.4, 'px', 0)).toBe(200)
    expect(toPixels(200.5, 'px', 0)).toBe(201)
    expect(toPixels(35, 'mm', 200)).toBe(276) // 275.59
  })
})

describe('resolveSpec', () => {
  it('turns a valid input into a spec', () => {
    const result = resolveSpec(input({ minKb: 20, maxKb: 50 }))
    expect(result).toEqual({
      ok: true,
      spec: {
        widthPx: 413,
        heightPx: 531,
        minKb: 20,
        maxKb: 50,
        format: 'jpg',
        background: '#ffffff',
      },
    })
  })

  it('accepts pixels without a DPI', () => {
    const result = resolveSpec(input({ width: 200, height: 230, unit: 'px', dpi: 0 }))
    expect(result.ok && [result.spec.widthPx, result.spec.heightPx]).toEqual([200, 230])
  })

  it('leaves the size limits out when none are given', () => {
    const result = resolveSpec(input())
    expect(result.ok && result.spec.minKb).toBeUndefined()
    expect(result.ok && result.spec.maxKb).toBeUndefined()
  })

  it('rejects a width or height that is not a positive number', () => {
    expect(errorsOf({ width: 0 })).toHaveLength(1)
    expect(errorsOf({ height: -4 })).toHaveLength(1)
    expect(errorsOf({ width: Number.NaN })).toHaveLength(1)
    expect(errorsOf({ width: Number.POSITIVE_INFINITY })).toHaveLength(1)
    expect(errorsOf({ width: 0, height: 0 })).toHaveLength(2)
  })

  it('needs a DPI for physical units', () => {
    expect(errorsOf({ dpi: 0 })).toHaveLength(1)
    expect(errorsOf({ dpi: Number.NaN, unit: 'in' })).toHaveLength(1)
    expect(errorsOf({ dpi: 0 })[0]).toMatch(/DPI/)
  })

  it('rejects size limits that are not positive', () => {
    expect(errorsOf({ maxKb: 0 })).toHaveLength(1)
    expect(errorsOf({ minKb: -1 })).toHaveLength(1)
  })

  it('rejects a minimum that is not below the maximum', () => {
    expect(errorsOf({ minKb: 50, maxKb: 20 })).toHaveLength(1)
    expect(errorsOf({ minKb: 50, maxKb: 50 })).toHaveLength(1)
    expect(errorsOf({ minKb: 20, maxKb: 50 })).toHaveLength(0)
  })

  it('rejects a result that is too small or too large in pixels', () => {
    expect(errorsOf({ width: 10, height: 300, unit: 'px' })).toHaveLength(1)
    expect(errorsOf({ width: 300, height: 5000, unit: 'px' })).toHaveLength(1)
    expect(errorsOf({ width: 20, height: 4000, unit: 'px' })).toHaveLength(0)
    // 50 inches at 300 DPI is 15000 px
    expect(errorsOf({ width: 50, height: 50, unit: 'in' })[0]).toMatch(/15000/)
  })

  it('reports every problem at once', () => {
    expect(errorsOf({ width: 0, dpi: 0, minKb: 0 })).toHaveLength(3)
  })
})
