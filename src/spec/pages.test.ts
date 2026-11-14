import { describe, expect, it } from 'vitest'
import { examHtml, pageWords, pathFor, portalForPath, sitemap, SITE } from './pages'
import { PORTALS } from './portals'

const HOME = `<!doctype html>
<html lang="en">
  <head>
    <meta
      name="description"
      content="The home page."
    />
    <title>Formify</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`

const gate = PORTALS.find((portal) => portal.slug === 'gate')!
const ssc = PORTALS.find((portal) => portal.slug === 'ssc-cgl')!

describe('exam addresses', () => {
  it('gives every exam its own address, in lower case with no spaces', () => {
    const slugs = PORTALS.map((portal) => portal.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('keeps clear of the addresses the site already uses', () => {
    for (const { slug } of PORTALS) expect(['api', 'assets', 'models', 'ort', 'mediapipe']).not.toContain(slug)
  })

  it('finds the exam for its address, with or without a closing slash, in any case', () => {
    expect(portalForPath('/gate')).toBe(gate)
    expect(portalForPath('/gate/')).toBe(gate)
    expect(portalForPath('/GATE')).toBe(gate)
  })

  it('finds none for the home page or an address it does not know', () => {
    expect(portalForPath('/')).toBeNull()
    expect(portalForPath('/gate/extra')).toBeNull()
    expect(portalForPath('/nothing')).toBeNull()
  })

  it('goes from an exam to its address and back', () => {
    for (const portal of PORTALS) expect(portalForPath(pathFor(portal))).toBe(portal)
    expect(pathFor(null)).toBe('/')
  })
})

describe('pageWords', () => {
  it('names the exam and both pictures', () => {
    const words = pageWords(gate)
    expect(words.title).toContain('GATE 2026 photo and signature size')
    expect(words.description).toContain(gate.photo!.rule)
    expect(words.description).toContain(gate.signature.rule)
  })

  it('speaks only of the signature when the exam takes no photo', () => {
    const words = pageWords(ssc)
    expect(words.title).toContain('SSC CGL 2026 signature size')
    expect(words.title).not.toContain('photo')
    // the reader is still told why there is no photo
    expect(words.rules[0].text).toBe(ssc.noPhoto)
  })

  it('gives every exam a title and a description of its own', () => {
    const titles = PORTALS.map((portal) => pageWords(portal).title)
    const descriptions = PORTALS.map((portal) => pageWords(portal).description)
    expect(new Set(titles).size).toBe(PORTALS.length)
    expect(new Set(descriptions).size).toBe(PORTALS.length)
  })
})

describe('examHtml', () => {
  const html = examHtml(HOME, gate)

  it('swaps the title and the description, leaving one of each', () => {
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html).toContain('<title>GATE 2026 photo and signature size')
    expect(html).not.toContain('The home page.')
  })

  it('names its own address as the one to index', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}/gate" />`)
  })

  it('says the rules in plain HTML, with where they came from', () => {
    expect(html).toContain('<h1>GATE 2026: photo and signature for the application form</h1>')
    expect(html).toContain(gate.signature.rule)
    expect(html).toContain(`href="${gate.source.url}"`)
  })

  it('keeps the script that starts the app', () => {
    expect(html).toContain('<script type="module" src="/assets/index-abc.js"></script>')
  })

  it('escapes what could be read as HTML', () => {
    const odd = { ...gate, notes: ['Width < height & "quoted"'] }
    expect(examHtml(HOME, odd)).toContain('Width &lt; height &amp; &quot;quoted&quot;')
  })

  it('refuses a home page it cannot change', () => {
    expect(() => examHtml('<html></html>', gate)).toThrow()
  })
})

describe('sitemap', () => {
  it('lists the home page and every exam page', () => {
    const xml = sitemap('2026-11-14')
    expect(xml.match(/<url>/g)).toHaveLength(PORTALS.length + 1)
    expect(xml).toContain(`<loc>${SITE}/</loc>`)
    expect(xml).toContain(`<loc>${SITE}/neet-ug</loc>`)
  })
})
