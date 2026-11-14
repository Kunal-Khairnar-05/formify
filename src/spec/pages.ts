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

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The built home page, turned into an exam's page: its own title, description and address
 * in the head, and the exam's rules as plain HTML inside the root element. The app replaces
 * that HTML when it starts, and shows the same rules itself; until then, and for a reader
 * that runs no script, the page still says what it is about.
 */
export function examHtml(home: string, portal: Portal): string {
  const words = pageWords(portal)
  const url = SITE + words.path
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(words.title)}" />`,
    `<meta property="og:description" content="${escape(words.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/icon-512.png" />`,
  ].join('\n    ')
  const body = [
    `<h1>${escape(words.heading)}</h1>`,
    ...words.rules.map((rule) => `<p><strong>${rule.label}:</strong> ${escape(rule.text)}</p>`),
    ...portal.notes.map((note) => `<p>${escape(note)}</p>`),
    `<p>Source: <a href="${escape(portal.source.url)}">${escape(portal.source.title)}</a>, checked on ${portal.checkedOn}.</p>`,
    `<p>Formify makes these files in your browser. Nothing is uploaded.</p>`,
  ].join('\n      ')

  const swapped = home
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(words.title)}</title>\n    ${head}`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${escape(words.description)}" />`,
    )
    .replace('<div id="root"></div>', `<div id="root">\n      ${body}\n    </div>`)
  if (swapped === home || !swapped.includes(body)) throw new Error('the home page is not shaped as expected')
  return swapped
}

/** Every page of the site, for search engines. */
export function sitemap(today: string): string {
  const urls = ['/', ...PORTALS.map(pathFor)]
    .map((path) => `  <url><loc>${SITE}${path}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
