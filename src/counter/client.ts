import type { Kind, Totals } from './server'

const isTotals = (value: unknown): value is Totals =>
  typeof value === 'object' &&
  value !== null &&
  ['photo', 'signature', 'total'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number')

// The count is a nicety. Whatever goes wrong with it (no network, no store set up, the
// development server, which has no such function) must never get in the way of the app,
// so every failure ends as "no count to show".
async function ask(init?: RequestInit): Promise<Totals | null> {
  try {
    const response = await fetch('/api/count', init)
    if (!response.ok) return null
    const body: unknown = await response.json()
    return isTotals(body) ? body : null
  } catch {
    return null
  }
}

/** How many pictures have been made so far, or null when that cannot be known. */
export const fetchTotals = () => ask()

/**
 * Tell the server one more picture was made. Only the kind is sent: nothing about the
 * picture or the person. Returns the new totals, or null.
 */
export const reportMade = (kind: Kind) =>
  ask({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
