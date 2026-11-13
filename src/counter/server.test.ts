import { describe, expect, it } from 'vitest'
import { countOne, isKind, redisStore, totals, visitorCode, type Store } from './server'

/** A store held in memory, behaving as Redis does for the three things the counter uses. */
function memoryStore() {
  const numbers = new Map<string, number>()
  const store: Store = {
    increment: async (key) => {
      numbers.set(key, (numbers.get(key) ?? 0) + 1)
      return numbers.get(key)!
    },
    read: async (keys) => keys.map((key) => numbers.get(key) ?? 0),
    tally: async (key) => {
      numbers.set(key, (numbers.get(key) ?? 0) + 1)
      return numbers.get(key)!
    },
  }
  return { store, numbers }
}

describe('isKind', () => {
  it('accepts the two kinds and nothing else', () => {
    expect(isKind('photo')).toBe(true)
    expect(isKind('signature')).toBe(true)
    for (const other of ['Photo', 'svg', '', null, undefined, 1, {}]) expect(isKind(other)).toBe(false)
  })
})

describe('totals', () => {
  it('is all zeros before anything has been made', async () => {
    expect(await totals(memoryStore().store)).toEqual({ photo: 0, signature: 0, total: 0 })
  })
})

describe('countOne', () => {
  it('adds one to the right kind and returns the new totals', async () => {
    const { store } = memoryStore()
    expect(await countOne(store, 'photo', 'a')).toEqual({ photo: 1, signature: 0, total: 1 })
    expect(await countOne(store, 'signature', 'a')).toEqual({ photo: 1, signature: 1, total: 2 })
    expect(await countOne(store, 'photo', 'b')).toEqual({ photo: 2, signature: 1, total: 3 })
  })

  it('stops counting a visitor who adds more in a minute than a person could', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 12; i++) expect(await countOne(store, 'photo', 'script')).not.toBeNull()
    expect(await countOne(store, 'photo', 'script')).toBeNull()
    expect(await countOne(store, 'photo', 'script')).toBeNull()
    // the refused ones were not counted
    expect((await totals(store)).photo).toBe(12)
  })

  it('does not let one visitor use up another visitor\'s allowance', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 20; i++) await countOne(store, 'photo', 'script')
    expect(await countOne(store, 'photo', 'someone else')).not.toBeNull()
  })
})

describe('visitorCode', () => {
  it('is the same for the same address on the same day', async () => {
    expect(await visitorCode('203.0.113.7', '2026-11-14')).toBe(await visitorCode('203.0.113.7', '2026-11-14'))
  })

  it('differs for another address, and for the same address on another day', async () => {
    const code = await visitorCode('203.0.113.7', '2026-11-14')
    expect(await visitorCode('203.0.113.8', '2026-11-14')).not.toBe(code)
    expect(await visitorCode('203.0.113.7', '2026-11-15')).not.toBe(code)
  })

  it('is short, and does not contain the address', async () => {
    const code = await visitorCode('203.0.113.7', '2026-11-14')
    expect(code).toMatch(/^[0-9a-f]{16}$/)
    expect(code).not.toContain('203')
  })
})

describe('redisStore', () => {
  /** A stand-in for fetch that records what was sent and answers as given. */
  function recorder(answers: unknown, ok = true, status = 200) {
    const sent: { url: string; headers: Record<string, string>; commands: unknown }[] = []
    const send = (async (url: string, init: RequestInit) => {
      sent.push({
        url,
        headers: init.headers as Record<string, string>,
        commands: JSON.parse(init.body as string),
      })
      return { ok, status, json: async () => answers } as Response
    }) as typeof fetch
    return { sent, send }
  }

  it('sends its commands together, with the token', async () => {
    const { sent, send } = recorder([{ result: 5 }])
    expect(await redisStore('https://db.example', 'secret', send).increment('k')).toBe(5)
    expect(sent[0].url).toBe('https://db.example/pipeline')
    expect(sent[0].headers.Authorization).toBe('Bearer secret')
    expect(sent[0].commands).toEqual([['INCR', 'k']])
  })

  it('reads several numbers at once, with 0 for one never set', async () => {
    const { sent, send } = recorder([{ result: ['7', null] }])
    expect(await redisStore('https://db.example', 't', send).read(['a', 'b'])).toEqual([7, 0])
    expect(sent[0].commands).toEqual([['MGET', 'a', 'b']])
  })

  it('tallies with a clock that starts at the first use', async () => {
    const { sent, send } = recorder([{ result: 3 }, { result: 0 }])
    expect(await redisStore('https://db.example', 't', send).tally('visitor', 60)).toBe(3)
    expect(sent[0].commands).toEqual([
      ['INCR', 'visitor'],
      ['EXPIRE', 'visitor', 60, 'NX'],
    ])
  })

  it('fails loudly when the store refuses the request or a command', async () => {
    const refused = recorder([], false, 401)
    await expect(redisStore('https://db.example', 'bad', refused.send).increment('k')).rejects.toThrow('401')
    const broken = recorder([{ error: 'ERR wrong type' }])
    await expect(redisStore('https://db.example', 't', broken.send).increment('k')).rejects.toThrow('wrong type')
  })
})
