import { describe, expect, it } from 'vitest'
import { resolveChecked } from './feasibility'
import { DEFAULT_FIELDS, parseFields, SIGNATURE_FIELDS } from './fields'
import { matchPortal, PORTALS } from './portals'

const kinds = ['photo', 'signature'] as const

describe('PORTALS', () => {
  it('has a unique id for every entry', () => {
    const ids = PORTALS.map((portal) => portal.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(PORTALS)('$name: every form detail can be made, with nothing to caution about', (portal) => {
    for (const kind of kinds) {
      const result = resolveChecked(parseFields(portal[kind].fields), kind)
      expect(result).toMatchObject({ ok: true, cautions: [] })
    }
  })

  it.each(PORTALS)('$name: the size filled in is inside the pixel range the portal states', (portal) => {
    for (const kind of kinds) {
      const { fields, pixels } = portal[kind]
      if (!pixels) continue
      const result = resolveChecked(parseFields(fields), kind)
      if (!result.ok) throw new Error('not resolved')
      const { widthPx, heightPx } = result.spec
      expect(widthPx).toBeGreaterThanOrEqual(pixels.minWidth)
      expect(widthPx).toBeLessThanOrEqual(pixels.maxWidth)
      expect(heightPx).toBeGreaterThanOrEqual(pixels.minHeight)
      expect(heightPx).toBeLessThanOrEqual(pixels.maxHeight)
    }
  })

  it.each(PORTALS)('$name: says where the numbers came from and when', (portal) => {
    expect(portal.source.url).toMatch(/^https:\/\//)
    expect(portal.source.title.length).toBeGreaterThan(10)
    expect(portal.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(portal.photo.rule.length).toBeGreaterThan(10)
    expect(portal.signature.rule.length).toBeGreaterThan(10)
  })

  it('an entry that was not read in full says so to the user', () => {
    for (const portal of PORTALS.filter((entry) => entry.confirmed === 'excerpt')) {
      expect(portal.notes.join(' ')).toMatch(/Check them against your own notice/)
    }
  })

  it('every entry asks for a JPG on a white background, as every source does', () => {
    for (const portal of PORTALS) {
      for (const kind of kinds) {
        expect(portal[kind].fields.format).toBe('jpg')
        expect(portal[kind].fields.background).toBe('#ffffff')
      }
    }
  })
})

describe('GATE 2026, against the numbers on its page', () => {
  const gate = PORTALS.find((portal) => portal.id === 'gate-2026')!

  it('keeps the photo between the aspect ratios 0.66 and 0.89', () => {
    const result = resolveChecked(parseFields(gate.photo.fields), 'photo')
    if (!result.ok) throw new Error('not resolved')
    const ratio = result.spec.widthPx / result.spec.heightPx
    expect(ratio).toBeGreaterThanOrEqual(0.66)
    expect(ratio).toBeLessThanOrEqual(0.89)
  })

  it('keeps the signature between 2.75 and 3.75 times as wide as it is tall', () => {
    const result = resolveChecked(parseFields(gate.signature.fields), 'signature')
    if (!result.ok) throw new Error('not resolved')
    const ratio = result.spec.widthPx / result.spec.heightPx
    expect(ratio).toBeGreaterThanOrEqual(2.75)
    expect(ratio).toBeLessThanOrEqual(3.75)
  })

  it('sets the file sizes the page gives', () => {
    expect(gate.photo.fields).toMatchObject({ minKb: '5', maxKb: '600' })
    expect(gate.signature.fields).toMatchObject({ minKb: '3', maxKb: '300' })
  })
})

describe('matchPortal', () => {
  it('finds the portal whose details are in both forms', () => {
    for (const portal of PORTALS) {
      expect(matchPortal({ photo: portal.photo.fields, signature: portal.signature.fields })?.id).toBe(portal.id)
    }
  })

  it('finds none once a detail has been changed by hand', () => {
    const [portal] = PORTALS
    const edited = { ...portal.photo.fields, maxKb: '77' }
    expect(matchPortal({ photo: edited, signature: portal.signature.fields })).toBeNull()
  })

  it('finds none when only one of the two forms matches', () => {
    const [portal] = PORTALS
    expect(matchPortal({ photo: portal.photo.fields, signature: SIGNATURE_FIELDS })?.id ?? null).not.toBe(portal.id)
  })

  it('finds none for the details the page starts with', () => {
    expect(matchPortal({ photo: DEFAULT_FIELDS, signature: SIGNATURE_FIELDS })).toBeNull()
  })
})
