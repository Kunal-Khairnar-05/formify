import { PORTALS, type Portal } from './portals'

/*
 * Every exam has its own address (/gate, /neet-ug) that opens the app already set up for
 * it. People search for "GATE photo size", and a senior or a teacher wants one link to
 * pass on: this gives both a page to land on. The words for each page are worked out here,
 * from the same entry the form is filled from, so a page can never disagree with the app.
 */

/** Where the site lives. Used for the addresses in the sitemap and in each page's head. */
export const SITE = 'https://formify-five-rust.vercel.app'

/** The exam whose page `pathname` is, or null: "/gate" and "/gate/" both give GATE. */
export function portalForPath(pathname: string): Portal | null {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  return PORTALS.find((portal) => portal.slug === slug) ?? null
}

/** The address of an exam's page, or of the home page when there is no exam. */
export const pathFor = (portal: Portal | null): string => (portal ? `/${portal.slug}` : '/')

export interface PageWords {
  /** The address, from the site's root: /gate. */
  path: string
  /** For the browser tab and the search result. */
  title: string
  /** For the search result and a shared link's preview. */
  description: string
  heading: string
  /** One line for each picture: what the exam asks of it. */
  rules: { label: string; text: string }[]
}

/** What an exam's page says, in its head and to a reader without JavaScript. */
export function pageWords(portal: Portal): PageWords {
  const both = portal.photo !== null
  const what = both ? 'photo and signature' : 'signature'
  const rules = [
    { label: 'Photo', text: portal.photo?.rule ?? portal.noPhoto ?? '' },
    { label: 'Signature', text: portal.signature.rule },
  ]
  return {
    path: pathFor(portal),
    title: `${portal.title} ${what} size: resize to the exact KB | Formify`,
    description:
      `Make your ${portal.title} ${what} in the size, KB and format the form asks for. ` +
      (both ? `Photo: ${portal.photo!.rule} ` : '') +
      `Signature: ${portal.signature.rule} Free, and nothing is uploaded.`,
    heading: `${portal.title}: ${what} for the application form`,
    rules,
  }
}

/** What the home page says, in its head and to a reader without JavaScript. */
export const HOME: PageWords = {
  path: '/',
  title: 'Formify: exam form photo and signature, resized to the exact KB',
  description:
    'Turn a selfie and a photo of your signature into files that fit your exam form: the exact size, KB and format, on a white background. Free, runs in your browser, and nothing is uploaded.',
  heading: 'Formify: photo and signature for exam application forms',
  rules: [],
}

/** The picture a shared link is shown with, 1200 x 630. */
const PREVIEW = '/preview.png'

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** What the page is, in the form search engines read: a free app that runs in a browser. */
function structured(words: PageWords): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Formify',
    url: SITE + words.path,
    description: words.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript and WebAssembly',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  }
  // "<" is written as an escape, so nothing in the words can close the script element
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/** Links to every page, so each can be reached from each without running a script. */
const links = (current: string) =>
  [{ path: '/', text: 'Formify home' }, ...PORTALS.map((portal) => ({ path: pathFor(portal), text: portal.title }))]
    .filter((link) => link.path !== current)
    .map((link) => `<a href="${link.path}">${escape(link.text)}</a>`)
    .join(' | ')

/**
 * The built page with one page's words written into it: title, description, its own
 * address, what a shared link shows, and `body` as plain HTML inside the root element.
 * The app replaces that HTML when it starts; until then, and for a reader that runs no
 * script, the page still says what it is about.
 */
function pageHtml(built: string, words: PageWords, body: string[]): string {
  const url = SITE + words.path
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Formify" />`,
    `<meta property="og:title" content="${escape(words.title)}" />`,
    `<meta property="og:description" content="${escape(words.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}${PREVIEW}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${structured(words)}</script>`,
  ].join('\n    ')
  const inside = [
    `<h1>${escape(words.heading)}</h1>`,
    ...body,
    `<p>Formify makes these files in your browser. Nothing is uploaded.</p>`,
    `<nav>${links(words.path)}</nav>`,
  ].join('\n      ')

  // replacements are given as functions, so a "$" in the words is not read as a pattern
  const swapped = built
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(words.title)}</title>\n    ${head}`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      () => `<meta name="description" content="${escape(words.description)}" />`,
    )
    .replace('<div id="root"></div>', () => `<div id="root">\n      ${inside}\n    </div>`)
  if (!swapped.includes(head) || !swapped.includes(inside)) throw new Error('the built page is not shaped as expected')
  return swapped
}

/** The built page, turned into an exam's page, with the exam's rules, notes and source. */
export function examHtml(built: string, portal: Portal): string {
  const words = pageWords(portal)
  return pageHtml(built, words, [
    ...words.rules.map((rule) => `<p><strong>${rule.label}:</strong> ${escape(rule.text)}</p>`),
    ...portal.notes.map((note) => `<p>${escape(note)}</p>`),
    `<p>Source: <a href="${escape(portal.source.url)}">${escape(portal.source.title)}</a>, checked on ${portal.checkedOn}.</p>`,
  ])
}

/** The built page, as the home page. */
export function homeHtml(built: string): string {
  return pageHtml(built, HOME, [
    `<p>${escape(HOME.description)}</p>`,
    `<p>Removes the background, crops to the form's shape, and fits the file between the form's minimum and maximum KB, as JPG or PNG. A signature is lifted off its paper and can be saved as an SVG.</p>`,
  ])
}

/**
 * The built page, made quicker to show. The stylesheet is a separate file the browser must
 * fetch before it paints anything; it is small, so it is written into the page instead.
 * The text font is asked for at once, rather than when the styles are first applied.
 */
export function quickHead(built: string, css: string, fontHref: string): string {
  const sheet = /<link rel="stylesheet"[^>]*>/
  if (!sheet.test(built)) throw new Error('the built page has no stylesheet to write in')
  const preload = `<link rel="preload" href="${fontHref}" as="font" type="font/woff2" crossorigin />`
  // nothing in the styles may close the style element early
  const safe = css.replace(/<\/style/gi, '<\\/style')
  return built.replace(sheet, () => `${preload}\n    <style>${safe}</style>`)
}

/** Every page of the site, for search engines. */
export function sitemap(today: string): string {
  const urls = ['/', ...PORTALS.map(pathFor)]
    .map((path) => `  <url><loc>${SITE}${path}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
