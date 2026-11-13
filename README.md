# Formify

Turns a selfie and a signature photo into files that meet an application form's exact photo rules.
Everything runs in the browser; the photo never leaves the device.

Live at https://formify-five-rust.vercel.app/

## Run

```bash
npm install
npm run dev
```

## Deploy

The site is static: `npm run build` writes everything to `dist/`. Any static host will do,
with one requirement: every response must carry these two headers, which let the model
runtime use threads.

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without them the app still works, on one thread and more slowly.

`vercel.json` sets them for Vercel, along with long caching for the built files (their
names carry a hash) and no caching for the service worker (so a new release is noticed).
To deploy there: import the repository in Vercel and accept the detected settings. The
build downloads one model (26 MB) and checks it against its checksum.

### The counter

`api/count.ts` is the site's one server function: it counts how many pictures have been made.
It needs a Redis database with a REST interface. On Vercel: Storage, then add Upstash for
Redis and connect it to the project, which sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`
(`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are read as well). Until then the
function answers 503 and the page shows no count. Only the kind of picture is sent; the
visitor's address is used, hashed, for one minute to stop a script inflating the number.

## Test

```bash
npm test
```

## Layout

| Path | What lives here |
| --- | --- |
| `src/pipeline/` | Image pipeline: load, landmarks, segmentation, composite, crop, encode, validate |
| `public/models/` | Model files and `models.json` |
| `MODELS.md` | Source, license and checksum of every model |
