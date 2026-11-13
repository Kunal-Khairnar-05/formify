import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELDS, parseFields } from './fields'
import { resolveSpec } from './units'

describe('parseFields', () => {
  it('reads the default form as 413 x 531 px, at most 50 KB', () => {
    const result = resolveSpec(parseFields(DEFAULT_FIELDS))
    expect(result).toEqual({
      ok: true,
      spec: { widthPx: 413, heightPx: 531, maxKb: 50, format: 'jpg', background: '#ffffff' },
    })
  })

  it('treats an empty limit as no limit', () => {
    const input = parseFields({ ...DEFAULT_FIELDS, minKb: '', maxKb: '  ' })
    expect(input.minKb).toBeUndefined()
    expect(input.maxKb).toBeUndefined()
  })

  it('reads limits and trims spaces', () => {
    const input = parseFields({ ...DEFAULT_FIELDS, width: ' 2 ', minKb: '20', maxKb: '100.5' })
    expect(input.width).toBe(2)
    expect(input.minKb).toBe(20)
    expect(input.maxKb).toBe(100.5)
  })

  it('makes an empty or non-numeric size a problem, not a zero', () => {
    for (const width of ['', '  ', 'abc', '3,5']) {
      const result = resolveSpec(parseFields({ ...DEFAULT_FIELDS, width }))
      expect(result.ok).toBe(false)
    }
  })

  it('does not need a DPI when the unit is pixels', () => {
    const result = resolveSpec(
      parseFields({ ...DEFAULT_FIELDS, width: '200', height: '230', unit: 'px', dpi: '' }),
    )
    expect(result.ok).toBe(true)
  })

  it('reports a non-numeric limit', () => {
    const result = resolveSpec(parseFields({ ...DEFAULT_FIELDS, maxKb: 'fifty' }))
    expect(result.ok).toBe(false)
  })
})
