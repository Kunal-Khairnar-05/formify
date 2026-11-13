import { useState } from 'react'
import type { SpecFields } from './spec/fields'
import { parseInstructions } from './spec/instructions'
import type { Resolved, Unit } from './spec/units'

const UNITS: { value: Unit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'inch' },
  { value: 'px', label: 'px' },
]

const box = 'nm-field mt-1 block'
const label = 'block text-sm font-medium'

interface Props {
  fields: SpecFields
  resolved: Resolved
  onChange: (fields: SpecFields) => void
}

/** What the form asks for: size, unit, DPI, file size limits and background colour. */
export function SpecForm({ fields, resolved, onChange }: Props) {
  const set = (patch: Partial<SpecFields>) => onChange({ ...fields, ...patch })
  const [pasted, setPasted] = useState('')
  // null until "Fill from text" has been pressed
  const [found, setFound] = useState<string[] | null>(null)

  function fillFromText() {
    const parsed = parseInstructions(pasted)
    setFound(parsed.found)
    set(parsed.fields)
  }

  return (
    <fieldset className="min-w-0 text-sm">
      <legend className="mb-3 text-base font-semibold">What the form asks for</legend>
      <label className={label}>
        Paste the portal's instructions (optional)
        <textarea
          id="spec-paste"
          className={`${box} h-20 resize-y`}
          placeholder="e.g. Dimensions 200 x 230 pixels, size between 20 KB and 50 KB"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
      </label>
      <button
        id="spec-fill"
        className="nm-btn mt-3"
        disabled={pasted.trim() === ''}
        onClick={fillFromText}
      >
        Fill from text
      </button>
      {found && (
        <p id="spec-found" className="mt-3">
          {found.length > 0
            ? `Found: ${found.join(', ')}. Check the boxes below against the portal.`
            : 'Nothing recognised in that text. Fill in the boxes below by hand.'}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className={label}>
          Width
          <input
            id="spec-width"
            className={box}
            inputMode="decimal"
            value={fields.width}
            onChange={(e) => set({ width: e.target.value })}
          />
        </label>
        <label className={label}>
          Height
          <input
            id="spec-height"
            className={box}
            inputMode="decimal"
            value={fields.height}
            onChange={(e) => set({ height: e.target.value })}
          />
        </label>
        <label className={label}>
          Unit
          <select
            id="spec-unit"
            className={box}
            value={fields.unit}
            onChange={(e) => set({ unit: e.target.value as Unit })}
          >
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          DPI
          <input
            id="spec-dpi"
            className={box}
            inputMode="numeric"
            disabled={fields.unit === 'px'}
            value={fields.dpi}
            onChange={(e) => set({ dpi: e.target.value })}
          />
        </label>
        <label className={label}>
          Min KB
          <input
            id="spec-min-kb"
            className={box}
            inputMode="decimal"
            placeholder="none"
            value={fields.minKb}
            onChange={(e) => set({ minKb: e.target.value })}
          />
        </label>
        <label className={label}>
          Max KB
          <input
            id="spec-max-kb"
            className={box}
            inputMode="decimal"
            placeholder="none"
            value={fields.maxKb}
            onChange={(e) => set({ maxKb: e.target.value })}
          />
        </label>
        <label className={label}>
          Background
          <input
            id="spec-background"
            className="nm-field mt-1 block h-9 cursor-pointer !p-1"
            type="color"
            value={fields.background}
            onChange={(e) => set({ background: e.target.value })}
          />
        </label>
      </div>
      {resolved.ok ? (
        <p id="spec-summary" className="mt-4 font-medium">
          Output: {resolved.spec.widthPx} x {resolved.spec.heightPx} px, JPG
        </p>
      ) : (
        <ul id="spec-errors" className="nm-danger mt-4 list-disc pl-5 font-medium">
          {resolved.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
