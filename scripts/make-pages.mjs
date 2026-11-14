// After the build, copies the home page once for each exam (dist/gate/index.html), with
// that exam's title, description and rules written into it: a page a search engine can
// read, and a link that opens the app set up for the exam. Also writes the sitemap.
//
// The words come from src/spec/pages.ts, which is TypeScript and shared with the app, so
// it is loaded through Vite rather than by Node itself.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'

const out = 'dist'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { examHtml, homeHtml, quickHead, sitemap, ROBOTS } = await vite.ssrLoadModule('/src/spec/pages.ts')
  const { PORTALS } = await vite.ssrLoadModule('/src/spec/portals.ts')
  // the page as Vite built it: every page, the home page too, is made from this
  const built = readFileSync(join(out, 'index.html'), 'utf8')
  // the stylesheet goes into the page, and the font the text is set in is asked for early
  const cssHref = built.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)?.[1]
  const font = readdirSync(join(out, 'assets')).find((name) => /^plus-jakarta-sans-latin-wght-normal-.*\.woff2$/.test(name))
  if (!cssHref || !font) throw new Error('the build has no stylesheet or no text font')
  const home = quickHead(built, readFileSync(join(out, cssHref), 'utf8'), `/assets/${font}`)
  writeFileSync(join(out, 'index.html'), homeHtml(home))
  for (const portal of PORTALS) {
    mkdirSync(join(out, portal.slug), { recursive: true })
    writeFileSync(join(out, portal.slug, 'index.html'), examHtml(home, portal))
  }
  writeFileSync(join(out, 'sitemap.xml'), sitemap(new Date().toISOString().slice(0, 10)))
  writeFileSync(join(out, 'robots.txt'), ROBOTS)
  console.log(`exam pages: ${PORTALS.map((portal) => '/' + portal.slug).join(' ')}, sitemap.xml, robots.txt`)
} finally {
  await vite.close()
}
