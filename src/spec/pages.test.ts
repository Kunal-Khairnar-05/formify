import { describe, expect, it } from 'vitest'
import { examHtml, HOME, homeHtml, pageWords, quickHead, pathFor, portalForPath, sitemap, SITE } from './pages'
import { PORTALS } from './portals'

const HOME_PAGE = `<!doctype html>
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
  const html = examHtml(HOME_PAGE, gate)

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
    expect(examHtml(HOME_PAGE, odd)).toContain('Width &lt; height &amp; &quot;quoted&quot;')
  })

  it('links to the home page and to every other exam, but not to itself', () => {
    expect(html).toContain('<a href="/">Formify home</a>')
    expect(html).toContain('<a href="/neet-ug">NEET UG 2026</a>')
    expect(html).not.toContain('<a href="/gate">')
  })

  it('says what it is in structured data that parses, with its own address', () => {
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as Record<string, unknown>
    expect(data['@type']).toBe('WebApplication')
    expect(data.url).toBe(`${SITE}/gate`)
  })

  it('cannot have its structured data closed by the words in it', () => {
    const odd = { ...gate, signature: { ...gate.signature, rule: '</script><b>' } }
    const json = examHtml(HOME_PAGE, odd).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]
    expect((JSON.parse(json) as { description: string }).description).toContain('</script><b>')
  })

  it('gives a shared link a picture', () => {
    expect(html).toContain(`<meta property="og:image" content="${SITE}/preview.png" />`)
  })

  it('refuses a home page it cannot change', () => {
    expect(() => examHtml('<html></html>', gate)).toThrow()
  })
})

describe('homeHtml', () => {
  const html = homeHtml(HOME_PAGE)

  it('has the home title, its own address, and one of each', () => {
    expect(html).toContain(`<title>${HOME.title}</title>`)
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`)
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
  })

  it('links to every exam page', () => {
    for (const portal of PORTALS) expect(html).toContain(`<a href="/${portal.slug}">`)
  })
})

describe('quickHead', () => {
  const built = '<head><link rel="stylesheet" crossorigin href="/assets/index-abc.css"></head>'
  const html = quickHead(built, 'p{color:red}', '/assets/font-abc.woff2')

  it('writes the styles into the page in place of the link to them', () => {
    expect(html).toContain('<style>p{color:red}</style>')
    expect(html).not.toContain('rel="stylesheet"')
  })

  it('asks for the font at once', () => {
    expect(html).toContain('<link rel="preload" href="/assets/font-abc.woff2" as="font" type="font/woff2" crossorigin />')
  })

  it('keeps a "$" in the styles as it is', () => {
    expect(quickHead(built, "a::after{content:'$&'}", '/f.woff2')).toContain("content:'$&'")
  })

  it('does not let the styles close their own element', () => {
    expect(quickHead(built, 'a{}</style><b>', '/f.woff2')).not.toContain('</style><b>')
  })

  it('refuses a page with no stylesheet', () => {
    expect(() => quickHead('<head></head>', '', '/f.woff2')).toThrow()
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
