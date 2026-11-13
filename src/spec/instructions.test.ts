import { describe, expect, it } from 'vitest'
import { findFormat, findDpi, findKb, findSize, parseInstructions } from './instructions'

describe('findSize', () => {
  it('reads a size with the unit after each number', () => {
    expect(findSize('Photo: 3.5 cm x 4.5 cm')).toEqual({ width: '3.5', height: '4.5', unit: 'cm' })
    expect(findSize('35mm x 45mm')).toEqual({ width: '35', height: '45', unit: 'mm' })
  })

  it('reads a size with the unit written once', () => {
    expect(findSize('Dimensions 200 x 230 pixels (preferred)')).toEqual({
      width: '200',
      height: '230',
      unit: 'px',
    })
    expect(findSize('2 x 2 inches')).toEqual({ width: '2', height: '2', unit: 'in' })
    expect(findSize('3.5cm x 4.5')).toEqual({ width: '3.5', height: '4.5', unit: 'cm' })
  })

  it('accepts other ways of writing "by"', () => {
    expect(findSize('140×60 px')).toEqual({ width: '140', height: '60', unit: 'px' })
    expect(findSize('140 X 60 PX')).toEqual({ width: '140', height: '60', unit: 'px' })
    expect(findSize('2 by 2 inch')).toEqual({ width: '2', height: '2', unit: 'in' })
    expect(findSize('200*230 pixel')).toEqual({ width: '200', height: '230', unit: 'px' })
  })

  it('leaves the unit out when the text gives none', () => {
    expect(findSize('size 200 x 230')).toEqual({ width: '200', height: '230', unit: undefined })
  })

  it('does not take the word "in" for inches', () => {
    expect(findSize('200 x 230 in JPG format')).toEqual({
      width: '200',
      height: '230',
      unit: undefined,
    })
  })

  it('reads labelled width and height', () => {
    expect(findSize('Width: 200 px, Height: 230 px')).toEqual({
      width: '200',
      height: '230',
      unit: 'px',
    })
    expect(findSize('height of 4.5 cm and width of 3.5 cm')).toEqual({
      width: '3.5',
      height: '4.5',
      unit: 'cm',
    })
  })

  it('returns null when there is no size', () => {
    expect(findSize('Upload a recent colour photograph.')).toBeNull()
    expect(findSize('width 200')).toBeNull()
    expect(findSize('')).toBeNull()
  })
})

describe('findKb', () => {
  it('reads a range', () => {
    expect(findKb('20 KB to 50 KB')).toEqual({ minKb: '20', maxKb: '50' })
    expect(findKb('between 20kb and 50kb')).toEqual({ minKb: '20', maxKb: '50' })
    expect(findKb('10kb – 20kb')).toEqual({ minKb: '10', maxKb: '20' })
    expect(findKb('size 20-50 KB')).toEqual({ minKb: '20', maxKb: '50' })
  })

  it('reads a maximum alone', () => {
    expect(findKb('Maximum file size is 100 KB')).toEqual({ maxKb: '100' })
    expect(findKb('should not be more than 50 KB')).toEqual({ maxKb: '50' })
    expect(findKb('less than 300kb')).toEqual({ maxKb: '300' })
    expect(findKb('max. 40 KB')).toEqual({ maxKb: '40' })
    expect(findKb('up to 200 KB')).toEqual({ maxKb: '200' })
  })

  it('reads a minimum alone', () => {
    expect(findKb('minimum 10 KB')).toEqual({ minKb: '10' })
    expect(findKb('at least 20 kb')).toEqual({ minKb: '20' })
    expect(findKb('more than 4 KB')).toEqual({ minKb: '4' })
  })

  it('does not confuse "not less than" with "less than"', () => {
    expect(findKb('not less than 20 KB')).toEqual({ minKb: '20' })
    expect(findKb('not more than 50 KB')).toEqual({ maxKb: '50' })
    expect(findKb('should not be less than 20 KB')).toEqual({ minKb: '20' })
    expect(findKb('Should not exceed 80 KB')).toEqual({ maxKb: '80' })
  })

  it('reads a minimum and a maximum written separately', () => {
    expect(findKb('Minimum 10 KB and maximum 20 KB')).toEqual({ minKb: '10', maxKb: '20' })
    expect(findKb('not less than 20 KB and not more than 50 KB')).toEqual({
      minKb: '20',
      maxKb: '50',
    })
  })

  it('converts MB to KB', () => {
    expect(findKb('Maximum 1 MB')).toEqual({ maxKb: '1024' })
    expect(findKb('500 KB to 2 MB')).toEqual({ minKb: '500', maxKb: '2048' })
  })

  it('ignores numbers that are not file sizes', () => {
    expect(findKb('3.5 cm x 4.5 cm at 200 dpi')).toEqual({})
    expect(findKb('')).toEqual({})
  })
})

describe('findDpi', () => {
  it('reads the number on either side of the word', () => {
    expect(findDpi('scanned at 200 DPI')).toBe('200')
    expect(findDpi('300dpi')).toBe('300')
    expect(findDpi('DPI: 300')).toBe('300')
    expect(findDpi('a dpi of 200')).toBe('200')
  })

  it('returns null when there is none', () => {
    expect(findDpi('200 x 230 pixels')).toBeNull()
  })
})

describe('parseInstructions', () => {
  it('reads a typical photo instruction', () => {
    const text =
      'Photograph must be a recent passport style colour picture. Dimensions 200 x 230 pixels ' +
      '(preferred). Size of file should be between 20kb–50 kb.'
    expect(parseInstructions(text)).toEqual({
      fields: { width: '200', height: '230', unit: 'px', minKb: '20', maxKb: '50' },
      found: ['Size 200 x 230 px', 'Minimum 20 KB', 'Maximum 50 KB'],
    })
  })

  it('reads a physical size with a DPI and one limit', () => {
    const text = 'Photo of 3.5 cm x 4.5 cm, scanned at 200 dpi, in JPG format, not more than 100 KB.'
    expect(parseInstructions(text)).toEqual({
      fields: { width: '3.5', height: '4.5', unit: 'cm', minKb: '', maxKb: '100', dpi: '200', format: 'jpg' },
      found: ['Size 3.5 x 4.5 cm', 'Maximum 100 KB', '200 DPI', 'JPG file'],
    })
  })

  it('leaves the size and DPI alone when the text gives only a limit', () => {
    expect(parseInstructions('File size: maximum 50 KB')).toEqual({
      fields: { minKb: '', maxKb: '50' },
      found: ['Maximum 50 KB'],
    })
  })

  it('clears the other limit when the text gives only one', () => {
    // otherwise a minimum from an earlier paste would stay in the form
    expect(parseInstructions('at least 10 KB').fields).toEqual({ minKb: '10', maxKb: '' })
  })

  it('does not touch the limits when the text gives none', () => {
    expect(parseInstructions('200 x 230 pixels').fields).toEqual({
      width: '200',
      height: '230',
      unit: 'px',
    })
  })

  it('finds nothing in unrelated text', () => {
    expect(parseInstructions('Please upload your photograph here.')).toEqual({
      fields: {},
      found: [],
    })
  })
})

describe('findFormat', () => {
  it('finds the one file type the text names', () => {
    expect(findFormat('Upload in JPG format only')).toBe('jpg')
    expect(findFormat('The photo must be a .jpeg file')).toBe('jpeg')
    expect(findFormat('Signature in PNG format, max 20 KB')).toBe('png')
  })

  it('does not mind the case', () => {
    expect(findFormat('format: Png')).toBe('png')
    expect(findFormat('jpg')).toBe('jpg')
  })

  it('takes JPG when both spellings appear', () => {
    expect(findFormat('Image should be in JPG/JPEG format')).toBe('jpg')
  })

  it('leaves the choice to the user when the text allows JPG or PNG', () => {
    expect(findFormat('Photo in JPG or PNG format')).toBeNull()
    expect(findFormat('Accepted: .jpeg, .png')).toBeNull()
  })

  it('finds nothing when no file type is named', () => {
    expect(findFormat('Dimensions 200 x 230 pixels, 20 KB to 50 KB')).toBeNull()
  })

  it('does not find a type inside another word', () => {
    expect(findFormat('Use the pngcrush tool')).toBeNull()
  })
})

describe('instructions written in other common ways', () => {
  // text, then what should be read from it; a missing value means "not found"
  const cases: [string, { size?: string; min?: string; max?: string; dpi?: string }][] = [
    [
      'Scanned photograph of 35mm width and 45mm height, 300 dpi, not exceeding 200 KB.',
      { size: '35 x 45 mm', max: '200', dpi: '300' },
    ],
    [
      'Photo size 4.5cm X 3.5cm, resolution 200 dpi, file must be at least 20 KB and at most 80 KB.',
      { size: '4.5 x 3.5 cm', min: '20', max: '80', dpi: '200' },
    ],
    [
      'Image dimension: 350px(W) x 450px(H); size 20-50 KB; format JPEG only',
      { size: '350 x 450 px', min: '20', max: '50' },
    ],
    ['Dimension 450 (H) x 350 (W) pixels, max 100 KB', { size: '350 x 450 px', max: '100' }],
    ['The photo should be 200 pixels wide and 230 pixels high.', { size: '200 x 230 px' }],
    ['Image must be 4.5 cm in height and 3.5 cm in width', { size: '3.5 x 4.5 cm' }],
    ['Height: 230 px, Width: 200 px, 300 dpi', { size: '200 x 230 px', dpi: '300' }],
    ['Width 3.5 cm, height 4.5 cm at 200 dpi', { size: '3.5 x 4.5 cm', dpi: '200' }],
    ['File size should be no more than 50 KB', { max: '50' }],
    ['File size must be no less than 10 KB', { min: '10' }],
    ['The file should not be larger than 300 kb', { max: '300' }],
    ['Size must be greater than 20 KB', { min: '20' }],
    ['Keep the file within 100 KB', { max: '100' }],
    ['Image should be smaller than 2 MB', { max: '2048' }],
    // a backwards "range" is not a range: 200 is the width, not a minimum
    ['Photo width 200 and 50 KB maximum', { max: '50' }],
    ['Signature 140 x 60 px, 10 KB minimum, 20 KB maximum', { size: '140 x 60 px', min: '10', max: '20' }],
    // a height followed by a DPI must not take the DPI as the height
    ['Signature of width 6 cm, 200 dpi', { dpi: '200' }],
  ]

  it.each(cases)('%s', (text, want) => {
    const size = findSize(text)
    expect(size ? `${size.width} x ${size.height}${size.unit ? ` ${size.unit}` : ''}` : undefined).toBe(want.size)
    const limits = findKb(text)
    expect(limits.minKb).toBe(want.min)
    expect(limits.maxKb).toBe(want.max)
    expect(findDpi(text) ?? undefined).toBe(want.dpi)
  })
})
