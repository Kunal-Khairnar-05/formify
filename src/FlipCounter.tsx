import { useState } from 'react'

/**
 * One digit shown as a card that turns over, like a page of a tear-off calendar, when the
 * digit changes.
 *
 * The card is two halves. While it turns, four pieces are on screen: the new digit's top
 * half and the old digit's bottom half lie still, the old top half folds down out of sight,
 * and then the new bottom half folds down into place over the old one.
 */
function FlipDigit({ digit }: { digit: string }) {
  // the digit on the card now; it follows `digit` once the turn has finished
  const [shown, setShown] = useState(digit)
  const turning = shown !== digit

  return (
    <span className="fc-digit" aria-hidden="true">
      <span className="fc-half fc-top">
        <span>{digit}</span>
      </span>
      <span className="fc-half fc-bottom">
        <span>{shown}</span>
      </span>
      {turning && (
        // keyed by the pair, so a second change while turning starts the turn afresh
        <span key={`${shown}${digit}`} className="contents">
          <span className="fc-half fc-top fc-leaf-top">
            <span>{shown}</span>
          </span>
          <span className="fc-half fc-bottom fc-leaf-bottom" onAnimationEnd={() => setShown(digit)}>
            <span>{digit}</span>
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * A number on flip cards. Each digit turns on its own, so going from 129 to 130 turns the
 * last two cards and leaves the first still.
 */
export function FlipCounter({ value, label }: { value: number; label: string }) {
  // grouped the Indian way: 12,34,567
  const text = value.toLocaleString('en-IN')
  const characters = [...text]
  return (
    <p id="made-count" className="flex flex-none items-center gap-2.5" aria-label={`${text} ${label}`}>
      <span className="flex items-center gap-0.5">
        {characters.map((character, index) => {
          // counted from the right, so a card keeps its place when the number grows a digit
          const place = characters.length - index
          return /\d/.test(character) ? (
            <FlipDigit key={place} digit={character} />
          ) : (
            <span key={place} className="fc-separator" aria-hidden="true">
              {character}
            </span>
          )
        })}
      </span>
      <span className="text-soft hidden text-xs leading-tight font-semibold sm:block" aria-hidden="true">
        {label}
      </span>
    </p>
  )
}
