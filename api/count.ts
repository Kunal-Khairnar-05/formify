// The site's one server function: GET /api/count gives how many pictures have been made,
// POST /api/count adds one. Everything else about the app runs in the visitor's browser.
//
// It needs a Redis database with a REST interface (Upstash, added to the project from
// Vercel's Storage tab), which sets the address and token below. Until one is added, the
// function says so and the page shows no count.

// The file ending is written out, and as .js: this runs in Node as an ES module, which
// looks for exactly the file named and finds the compiled one.
import { countOne, isKind, redisStore, totals, visitorCode } from '../src/counter/server.js'

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    // a count is out of date the moment it is given
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const notSetUp = () => json({ error: 'The counter has no store yet.' }, 503)

export async function GET(): Promise<Response> {
  if (!url || !token) return notSetUp()
  try {
    return json(await totals(redisStore(url, token)))
  } catch {
    return json({ error: 'The count could not be read.' }, 502)
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!url || !token) return notSetUp()
  let kind: unknown
  try {
    kind = ((await request.json()) as { kind?: unknown }).kind
  } catch {
    kind = undefined
  }
  if (!isKind(kind)) return json({ error: 'kind must be "photo" or "signature".' }, 400)

  try {
    // the first address in the list is the visitor's own; the rest are proxies on the way
    const address = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
    const visitor = await visitorCode(address, new Date().toISOString().slice(0, 10))
    const result = await countOne(redisStore(url, token), kind, visitor)
    return result ? json(result) : json({ error: 'Too many in one minute.' }, 429)
  } catch {
    return json({ error: 'The count could not be saved.' }, 502)
  }
}
