import { describe, expect, it } from 'vitest'
import { fitKb } from './fitKb'

/** Fake encoder: output grows with quality, `bytesPerQuality` bytes per quality step. */
function fakeEncoder(bytesPerQuality: number) {
  const calls: number[] = []
  const encode = async (quality: number) => {
    calls.push(quality)
    return new Uint8Array(quality * bytesPerQuality)
  }
  return { encode, calls }
}

describe('fitKb', () => {
  it('returns the highest quality that fits under the limit with a 5% margin', async () => {
    // 1000 bytes per step, limit 60 KB -> target 57,000 bytes -> quality 57
    const { encode } = fakeEncoder(1000)
    const result = await fitKb(encode, 60)
    expect(result?.quality).toBe(57)
    expect(result?.bytes.length).toBe(57_000)
  })

  it('returns the top quality when everything fits', async () => {
    const { encode } = fakeEncoder(100)
    expect((await fitKb(encode, 500))?.quality).toBe(95)
  })

  it('returns null when even the lowest quality is too large', async () => {
    const { encode } = fakeEncoder(1000)
    expect(await fitKb(encode, 10)).toBeNull()
  })

  it('accepts the lowest quality when only that one fits', async () => {
    // target = 43 KB * 950 = 40,850 bytes -> quality 40 fits, 41 does not
    const { encode } = fakeEncoder(1000)
    expect((await fitKb(encode, 43))?.quality).toBe(40)
  })

  it('needs at most 6 encodes', async () => {
    for (const limit of [10, 43, 60, 77, 500]) {
      const { encode, calls } = fakeEncoder(1000)
      await fitKb(encode, limit)
      expect(calls.length).toBeLessThanOrEqual(6)
    }
  })

  it('goes above the usual top quality only when told to', async () => {
    const { encode } = fakeEncoder(100)
    expect((await fitKb(encode, 500, 100))?.quality).toBe(100)
    expect((await fitKb(encode, 500, 97))?.quality).toBe(97)
    expect((await fitKb(encode, 500))?.quality).toBe(95)
  })

  it('still needs at most 6 encodes with the wider range', async () => {
    for (const limit of [10, 43, 60, 77, 99, 500]) {
      const { encode, calls } = fakeEncoder(1000)
      await fitKb(encode, limit, 100)
      expect(calls.length).toBeLessThanOrEqual(6)
    }
  })

  it('never returns bytes above the target', async () => {
    for (const limit of [45, 52, 60, 71, 88, 99]) {
      const { encode } = fakeEncoder(1000)
      const result = await fitKb(encode, limit)
      expect(result!.bytes.length).toBeLessThanOrEqual(limit * 1000 * 0.95)
    }
  })
})
