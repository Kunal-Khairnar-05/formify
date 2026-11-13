// The counter's logic, as run by the server function in api/count.ts. It counts how many
// pictures have been made, and nothing else: no photo, no name, no address is stored.

export type Kind = 'photo' | 'signature'

export interface Totals {
  photo: number
  signature: number
  total: number
}

/** The few things the counter needs from a store. Redis in production, a fake in tests. */
export interface Store {
  /** Add one to a number and return the new value. Must be atomic: two at once give two. */
  increment(key: string): Promise<number>
  /** The numbers stored under these keys; 0 for one that was never set. */
  read(keys: string[]): Promise<number[]>
  /**
   * Count one more use under `key`, forgetting the count `seconds` after its first use,
   * and return the count so far.
   */
  tally(key: string, seconds: number): Promise<number>
}

const KEYS: Record<Kind, string> = { photo: 'formify:made:photo', signature: 'formify:made:signature' }

// one visitor may add this many in a minute; a person cannot make pictures faster
const MOST_PER_MINUTE = 12
const MINUTE = 60

export const isKind = (value: unknown): value is Kind => value === 'photo' || value === 'signature'

/**
 * A short code that stands for a visitor for the next minute, made from their address so
 * that the address itself is never stored. The date is mixed in so the same address gives
 * a different code each day, and the code cannot be turned back into the address.
 */
export async function visitorCode(address: string, day: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${address}|${day}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function totals(store: Store): Promise<Totals> {
  const [photo, signature] = await store.read([KEYS.photo, KEYS.signature])
  return { photo, signature, total: photo + signature }
}

/**
 * Count one picture made. Returns the new totals, or null when this visitor has added more
 * in the last minute than a person could: a script inflating the number.
 */
export async function countOne(store: Store, kind: Kind, visitor: string): Promise<Totals | null> {
  const recent = await store.tally(`formify:recent:${visitor}`, MINUTE)
  if (recent > MOST_PER_MINUTE) return null
  await store.increment(KEYS[kind])
  return totals(store)
}

/**
 * A Redis database reached over HTTPS (Upstash's REST interface), which a server function
 * can call without holding a connection open. Commands are sent together as one request.
 */
export function redisStore(url: string, token: string, send: typeof fetch = fetch): Store {
  const run = async (commands: (string | number)[][]): Promise<unknown[]> => {
    const response = await send(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
    if (!response.ok) throw new Error(`The counter's store answered ${response.status}`)
    const answers = (await response.json()) as { result?: unknown; error?: string }[]
    return answers.map((answer) => {
      if (answer.error) throw new Error(answer.error)
      return answer.result
    })
  }
  return {
    increment: async (key) => Number((await run([['INCR', key]]))[0]),
    read: async (keys) => {
      const [values] = await run([['MGET', ...keys]])
      return (values as (string | null)[]).map((value) => Number(value ?? 0))
    },
    tally: async (key, seconds) => {
      // NX: the clock starts at the first use and is not pushed back by later ones
      const [count] = await run([
        ['INCR', key],
        ['EXPIRE', key, seconds, 'NX'],
      ])
      return Number(count)
    },
  }
}
