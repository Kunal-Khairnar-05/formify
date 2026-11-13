// Formify's service worker: it sits between the page and the network and keeps copies of
// what the page fetches, so a second visit downloads nothing and the app works offline.
//
// Three kinds of file, three ways of serving them:
//
//   built files (/assets/...)      cache first. Their names carry a hash of their contents,
//                                  so a file with a given name never changes.
//   models and runtimes            stale while revalidate. Megabytes each, and named the
//   (/models, /ort, /mediapipe)    same from one release to the next: serve the copy at
//                                  once, and ask the server in the background whether it
//                                  has changed, which costs a few bytes when it has not.
//   the page itself, and the rest  network first, so a new release is seen at once; the
//                                  copy is used only when there is no network.

const VERSION = 'v1'
const BUILT = `formify-built-${VERSION}`
const HEAVY = `formify-heavy-${VERSION}`
const PAGES = `formify-pages-${VERSION}`
const KEPT = [BUILT, HEAVY, PAGES]

const isHeavy = (path) => /^\/(models|ort|mediapipe)\//.test(path)

// take over as soon as installed, rather than waiting for every tab to close
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // caches from an older version of this file are dropped
      for (const name of await caches.keys()) {
        if (name.startsWith('formify-') && !KEPT.includes(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

/**
 * The copy kept for a request, if there is one. Servers often mark an answer as varying
 * with the Origin header, and the same file is asked for with and without that header
 * (by a script tag, by an import inside a worker). The file is the same either way, so
 * the header is not allowed to hide the copy.
 */
const stored = (request) => caches.match(request, { ignoreVary: true })

/** Keep a copy of a good answer. A partial or failed one is not worth keeping. */
async function keep(cacheName, request, response) {
  if (response.ok && response.status === 200) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

async function cacheFirst(request) {
  const copy = await stored(request)
  return copy ?? keep(BUILT, request, await fetch(request))
}

async function staleWhileRevalidate(event) {
  const { request } = event
  const copy = await stored(request)
  // 'no-cache' makes the browser ask the server whether its copy is still good, and the
  // server answers "not modified" in a few bytes when it is
  const fresh = fetch(request, { cache: 'no-cache' }).then((response) => keep(HEAVY, request, response))
  if (!copy) return fresh
  // the check carries on after the answer has been given; offline, it simply fails
  event.waitUntil(fresh.catch(() => {}))
  return copy
}

async function networkFirst(request) {
  try {
    return await keep(PAGES, request, await fetch(request))
  } catch (error) {
    const copy = await stored(request)
    if (copy) return copy
    // a page address this worker has not seen, offline: the app is one page, so give that
    if (request.mode === 'navigate') {
      const home = await caches.match('/', { ignoreVary: true })
      if (home) return home
    }
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // only this site's own files, and only plain reads, are handled; the rest goes straight through
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // a request for part of a file cannot be answered from a whole copy
  if (request.headers.has('range')) return

  if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(request))
  else if (isHeavy(url.pathname)) event.respondWith(staleWhileRevalidate(event))
  else event.respondWith(networkFirst(request))
})
