import type { SpecFields } from './fields'

/** A range of whole pixels a portal allows for one picture. */
interface PixelRange {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

/** What a portal asks of one picture, with the form details that meet it. */
export interface PortalPicture {
  /** The form details that are filled in when the portal is chosen. */
  fields: SpecFields
  /** The portal's own rule, in its own numbers, shown to the user. */
  rule: string
  /** The pixel sizes the portal accepts, where it states them. */
  pixels?: PixelRange
}

/**
 * An exam or portal whose photo and signature rules are known.
 *
 * Every entry was taken from the organisation's own page or notice, never from memory or
 * from a coaching site: these numbers differ between exams and change from year to year,
 * and a wrong one gets an application rejected. `source` says where each came from and
 * `confirmed` says how well it was checked.
 */
export interface Portal {
  id: string
  name: string
  /** Which exam cycle or document the numbers are for. */
  edition: string
  photo: PortalPicture
  signature: PortalPicture
  source: { title: string; url: string }
  /** The day the source was read, as YYYY-MM-DD. */
  checkedOn: string
  /**
   * 'read': the official page or document was read in full for this entry.
   * 'excerpt': only excerpts of official notices, as returned by a web search, were seen.
   */
  confirmed: 'read' | 'excerpt'
  /** Things the user must check for themselves, where the app cannot. */
  notes: string[]
}

const WHITE = '#ffffff'

/** 3.5 x 4.5 cm at 300 DPI: 413 x 531 px, the usual passport-size photo. */
const passportPhoto = (minKb: string, maxKb: string): SpecFields => ({
  width: '3.5',
  height: '4.5',
  unit: 'cm',
  dpi: '300',
  minKb,
  maxKb,
  format: 'jpg',
  background: WHITE,
})

const inPixels = (width: number, height: number, minKb: string, maxKb: string): SpecFields => ({
  width: String(width),
  height: String(height),
  unit: 'px',
  // not used for pixels; kept at the usual value for when the unit is changed
  dpi: '300',
  minKb,
  maxKb,
  format: 'jpg',
  background: WHITE,
})

export const PORTALS: Portal[] = [
  {
    id: 'gate-2026',
    name: 'GATE',
    edition: 'GATE 2026 (IIT Guwahati)',
    photo: {
      fields: passportPhoto('5', '600'),
      rule: 'JPG, 3.5 x 4.5 cm shape, 200 x 260 to 530 x 690 px, 5 to 600 KB, white background.',
      pixels: { minWidth: 200, minHeight: 260, maxWidth: 530, maxHeight: 690 },
    },
    signature: {
      // height : width must be 1 : 2.75 to 1 : 3.75; this is 1 : 3.2
      fields: inPixels(480, 150, '3', '300'),
      rule: 'JPG, 250 x 80 to 580 x 180 px, width 2.75 to 3.75 times the height, 3 to 300 KB.',
      pixels: { minWidth: 250, minHeight: 80, maxWidth: 580, maxHeight: 180 },
    },
    source: {
      title: 'GATE 2026: Photograph and Signature',
      url: 'https://gate2026.iitg.ac.in/photograph-and-signature.html',
    },
    checkedOn: '2026-11-14',
    confirmed: 'read',
    notes: [
      'The face must fill 60 to 70% of the photo, and the signature 70 to 80% of its picture.',
      'Sign in black or dark blue ink. A signature in capital letters or as initials is refused.',
      'A later GATE is run by a different institute and may change these numbers.',
    ],
  },
  {
    id: 'jee-main-2027',
    name: 'JEE Main',
    edition: 'JEE (Main) 2027 (NTA information bulletin)',
    photo: {
      fields: passportPhoto('10', '200'),
      rule: 'JPG, passport size, in colour, 80% face, white background, 10 to 200 KB. No pixel size is given.',
    },
    signature: {
      // the bulletin gives no size for the signature; this is a common shape for one
      fields: inPixels(350, 150, '10', '100'),
      rule: 'JPG, 10 to 100 KB. No size in pixels or cm is given.',
    },
    source: {
      title: 'Information Bulletin: Joint Entrance Examination (Main) 2027',
      url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/202610241890224107.pdf',
    },
    checkedOn: '2026-11-14',
    confirmed: 'read',
    notes: [
      'The bulletin sets no pixel size, so the sizes here are a sensible choice, not a rule. If the upload page asks for a size, use that.',
      'The face, ears included and without a mask, must fill about 80% of the photo.',
      'The form also takes a live photo, separately from this upload.',
    ],
  },
  {
    id: 'upsc',
    name: 'UPSC',
    edition: 'UPSC online application (One Time Registration FAQ)',
    photo: {
      // both sides must be 350 to 1000 px; 3.5 x 4.5 cm at 300 DPI is 413 x 531 px
      fields: passportPhoto('20', '300'),
      rule: 'JPG, 350 x 350 to 1000 x 1000 px, 20 to 300 KB.',
      pixels: { minWidth: 350, minHeight: 350, maxWidth: 1000, maxHeight: 1000 },
    },
    signature: {
      // the height, too, must be at least 350 px
      fields: inPixels(700, 350, '20', '300'),
      rule: 'JPG, 350 x 350 to 1000 x 1000 px, 20 to 300 KB, signed on white paper, preferably in black ink.',
      pixels: { minWidth: 350, minHeight: 350, maxWidth: 1000, maxHeight: 1000 },
    },
    source: {
      title: 'UPSC One Time Registration: Frequently Asked Questions (questions 43 and 44)',
      url: 'https://upsconline.gov.in/upsc/OTRP/candidate/faq.php',
    },
    checkedOn: '2026-11-14',
    confirmed: 'read',
    notes: [
      'Some UPSC upload pages ask for three signatures, one under another, in a single picture. Formify makes one signature: if your page asks for three, this result will not do.',
      'An individual exam notice may set tighter limits than this general page. Check the notice for your exam.',
    ],
  },
  {
    id: 'ibps-sbi',
    name: 'IBPS and SBI',
    edition: 'IBPS-run bank recruitment forms (2025 and 2026 notices)',
    photo: {
      fields: inPixels(200, 230, '20', '50'),
      rule: 'JPG, 200 x 230 px preferred, 20 to 50 KB.',
    },
    signature: {
      fields: inPixels(140, 60, '10', '20'),
      rule: 'JPG, 140 x 60 px preferred, 10 to 20 KB, in black ink on white paper.',
    },
    source: {
      title: 'IBPS: Guidelines for scanning and upload of documents (CRP PO/MT notice)',
      url: 'https://ibpsreg.ibps.in/crppoxvjun25/',
    },
    checkedOn: '2026-11-14',
    confirmed: 'excerpt',
    notes: [
      'These numbers were seen only as excerpts of official IBPS notices in a web search; the notices themselves could not be opened. Check them against your own notice before uploading.',
      'A signature in capital letters is not accepted.',
      'These forms also ask for a thumb impression and a handwritten declaration, which Formify does not make.',
    ],
  },
]

const same = (a: SpecFields, b: SpecFields) =>
  (Object.keys(a) as (keyof SpecFields)[]).every((key) => a[key] === b[key])

/** The portal whose details are in both forms exactly as it fills them, if any. */
export function matchPortal(fields: { photo: SpecFields; signature: SpecFields }): Portal | null {
  return (
    PORTALS.find(
      (portal) => same(portal.photo.fields, fields.photo) && same(portal.signature.fields, fields.signature),
    ) ?? null
  )
}
