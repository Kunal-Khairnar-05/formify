import { describe, expect, it } from 'vitest'
import { resolveChecked } from './feasibility'
import { DEFAULT_FIELDS, parseFields, SIGNATURE_FIELDS } from './fields'
import { chosenPortal, PORTALS } from './portals'

const kinds = ['photo', 'signature'] as const

describe('PORTALS', () => {
  it('has a unique id for every entry', () => {
    const ids = PORTALS.map((portal) => portal.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(PORTALS)('$name: every form detail can be made, with nothing to caution about', (portal) => {
    for (const kind of kinds) {
      const picture = portal[kind]
      if (!picture) continue
      const result = resolveChecked(parseFields(picture.fields), kind)
      expect(result).toMatchObject({ ok: true, cautions: [] })
    }
  })

  it.each(PORTALS)('$name: the size filled in is inside the pixel range the portal states', (portal) => {
    for (const kind of kinds) {
      const picture = portal[kind]
      if (!picture?.pixels) continue
      const { fields, pixels } = picture
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
    // either the photo's rule, or why there is no photo to upload
    expect((portal.photo?.rule ?? portal.noPhoto ?? '').length).toBeGreaterThan(10)
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
        const picture = portal[kind]
        if (!picture) continue
        expect(picture.fields.format).toBe('jpg')
        expect(picture.fields.background).toBe('#ffffff')
      }
    }
  })
})

describe('GATE 2026, against the numbers on its page', () => {
  const gate = PORTALS.find((portal) => portal.id === 'gate-2026')!

  it('keeps the photo between the aspect ratios 0.66 and 0.89', () => {
    const result = resolveChecked(parseFields(gate.photo!.fields), 'photo')
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
    expect(gate.photo!.fields).toMatchObject({ minKb: '5', maxKb: '600' })
    expect(gate.signature.fields).toMatchObject({ minKb: '3', maxKb: '300' })
  })
})

describe('chosenPortal', () => {
  it('gives the chosen portal while both forms hold what it filled in', () => {
    for (const portal of PORTALS) {
      const photo = portal.photo?.fields ?? DEFAULT_FIELDS
      expect(chosenPortal(portal.id, { photo, signature: portal.signature.fields })?.id).toBe(portal.id)
    }
  })

  it('tells apart two exams that ask for the same numbers', () => {
    const jee = PORTALS.find((portal) => portal.id === 'jee-main-2027')!
    const neet = PORTALS.find((portal) => portal.id === 'neet-ug-2026')!
    const fields = { photo: neet.photo!.fields, signature: neet.signature.fields }
    // the numbers are the same, so only the id says which was chosen
    expect(fields).toEqual({ photo: jee.photo!.fields, signature: jee.signature.fields })
    expect(chosenPortal('neet-ug-2026', fields)?.id).toBe('neet-ug-2026')
    expect(chosenPortal('jee-main-2027', fields)?.id).toBe('jee-main-2027')
  })

  it('gives none once a detail has been changed by hand', () => {
    const [portal] = PORTALS
    const edited = { ...portal.photo!.fields, maxKb: '77' }
    expect(chosenPortal(portal.id, { photo: edited, signature: portal.signature.fields })).toBeNull()
    const signature = { ...portal.signature.fields, width: '999' }
    expect(chosenPortal(portal.id, { photo: portal.photo!.fields, signature })).toBeNull()
  })

  it('gives none when nothing was chosen, or the id is not known', () => {
    const [portal] = PORTALS
    const fields = { photo: portal.photo!.fields, signature: portal.signature.fields }
    expect(chosenPortal(null, fields)).toBeNull()
    expect(chosenPortal('no-such-exam', fields)).toBeNull()
  })

  it('gives none for the details the page starts with', () => {
    for (const portal of PORTALS.filter((entry) => entry.photo)) {
      expect(chosenPortal(portal.id, { photo: DEFAULT_FIELDS, signature: SIGNATURE_FIELDS })).toBeNull()
    }
  })
})

describe('a portal with no photo to upload', () => {
  const ssc = PORTALS.find((portal) => portal.id === 'ssc-cgl-2026')!

  it('says why, in place of a photo rule', () => {
    expect(ssc.photo).toBeNull()
    expect(ssc.noPhoto).toContain('no photo to upload')
  })

  it('stays chosen whatever the photo details are', () => {
    expect(chosenPortal(ssc.id, { photo: DEFAULT_FIELDS, signature: ssc.signature.fields })?.id).toBe(ssc.id)
  })

  it('gives a signature of about 6 x 2 cm within 10 to 20 KB', () => {
    const result = resolveChecked(parseFields(ssc.signature.fields), 'signature')
    if (!result.ok) throw new Error('not resolved')
    // 6 cm and 2 cm at 200 DPI
    expect(result.spec).toMatchObject({ widthPx: 472, heightPx: 157, minKb: 10, maxKb: 20 })
  })
})
