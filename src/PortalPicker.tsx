import { AlertIcon, CheckIcon, ChevronIcon } from './icons'
import { PORTALS, type Portal } from './spec/portals'

const OWN = 'own'

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

interface Props {
  /** The portal whose details are in the form now; null when they are the user's own. */
  portal: Portal | null
  /** What is being made, to show that picture's rule. */
  kind: 'photo' | 'signature'
  onChoose: (portal: Portal) => void
  /** Go back to no exam. The numbers in the form stay as they are, for the user to change. */
  onClear: () => void
}

/**
 * Choose an exam and both forms are filled with what it asks for. Shows the portal's own
 * rule, where it came from and when it was checked, because these rules change every year
 * and the user is the one who pays for a wrong number.
 */
export function PortalPicker({ portal, kind, onChoose, onClear }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Your exam or portal
        <span className="nm-field relative">
          <select
            id="portal"
            className="cursor-pointer appearance-none pr-6"
            value={portal?.id ?? OWN}
            onChange={(e) => {
              const chosen = PORTALS.find((entry) => entry.id === e.target.value)
              if (chosen) onChoose(chosen)
              // the first line of the list: no exam
              else onClear()
            }}
          >
            <option value={OWN}>{portal ? 'No exam: use my own numbers' : 'Choose one, or type your own numbers below'}</option>
            {PORTALS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3">
            <ChevronIcon size={16} />
          </span>
        </span>
      </label>

      {portal && (
        <div id="portal-info" className="card flex flex-col gap-2.5 p-3 text-sm">
          <p className="flex items-start gap-2 font-semibold">
            <span className="nm-good">
              <CheckIcon />
            </span>
            <span>
              Filled in for {portal.edition}
              <span className="text-soft block text-xs font-medium">
                {portal.photo
                  ? 'Photo and signature are both set. Switch between them in the sidebar.'
                  : 'Only the signature is set: this portal has no photo to upload.'}
              </span>
            </span>
          </p>
          {portal[kind] ? (
            <p>
              <span className="text-soft text-xs font-bold tracking-wide">
                THE {kind === 'photo' ? 'PHOTO' : 'SIGNATURE'} RULE
              </span>
              <span className="block font-medium">{portal[kind].rule}</span>
            </p>
          ) : (
            <p id="portal-no-photo" className="nm-note">
              <AlertIcon />
              {portal.noPhoto}
            </p>
          )}
          {portal.notes.map((note) => (
            <p key={note} className="flex items-start gap-2 text-xs font-medium">
              <AlertIcon size={16} />
              {note}
            </p>
          ))}
          <p className="text-soft text-xs">
            {portal.confirmed === 'read' ? 'Read from' : 'Not read in full. Based on'}{' '}
            <a
              className="font-semibold underline underline-offset-2"
              href={portal.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {portal.source.title}
            </a>{' '}
            on {day(portal.checkedOn)}. Rules change every year: check your own notice before you upload.
          </p>
          <button id="portal-clear" className="nm-btn !min-h-9 self-start !text-xs" onClick={onClear}>
            Remove this exam
          </button>
        </div>
      )}
    </div>
  )
}
