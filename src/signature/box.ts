import type { Rect } from '../pipeline/types'

/**
 * The rectangle to cut out for the output: the ink with a margin around it, widened or
 * heightened to the output's shape so the signature is never stretched. It may reach
 * outside the image; that part is filled with the background colour later.
 * `margin` is a fraction of the ink's longer side, added on every side.
 */
export function signatureBox(ink: Rect, aspect: number, margin: number): Rect {
  const pad = Math.max(ink.width, ink.height) * margin
  let width = ink.width + 2 * pad
  let height = ink.height + 2 * pad

  if (width / height < aspect) width = height * aspect
  else height = width / aspect

  const centreX = ink.x + ink.width / 2
  const centreY = ink.y + ink.height / 2
  return {
    x: Math.round(centreX - width / 2),
    y: Math.round(centreY - height / 2),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}
