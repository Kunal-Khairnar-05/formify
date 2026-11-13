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

const box = 'w-full rounded border border-neutral-300 px-2 py-1'

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
    <fieldset className="mt-4 rounded border border-neutral-300 p-3 text-sm">
      <legend className="px-1 font-medium">What the form asks for</legend>
      <label>
        Paste the portal's instructions (optional)
        <textarea
          id="spec-paste"
          className={`${box} h-20`}
          placeholder="e.g. Dimensions 200 x 230 pixels, size between 20 KB and 50 KB"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
      </label>
      <button
        id="spec-fill"
        className="mt-2 rounded border border-neutral-400 px-3 py-1 disabled:opacity-40"
        disabled={pasted.trim() === ''}
        onClick={fillFromText}
      >
        Fill from text
      </button>
      {found && (
        <p id="spec-found" className="mt-2 mb-3 text-neutral-600">
          {found.length > 0
            ? `Found: ${found.join(', ')}. Check the boxes below against the portal.`
            : 'Nothing recognised in that text. Fill in the boxes below by hand.'}
        </p>
      )}
      <div className="mt-3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label>
          Width
          <input
            id="spec-width"
            className={box}
            inputMode="decimal"
            value={fields.width}
            onChange={(e) => set({ width: e.target.value })}
          />
        </label>
        <label>
          Height
          <input
            id="spec-height"
            className={box}
            inputMode="decimal"
            value={fields.height}
            onChange={(e) => set({ height: e.target.value })}
          />
        </label>
        <label>
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
        <label className={fields.unit === 'px' ? 'opacity-40' : ''}>
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
        <label>
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
        <label>
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
        <label>
          Background
          <input
            id="spec-background"
            className="block h-8 w-full rounded border border-neutral-300"
            type="color"
            value={fields.background}
            onChange={(e) => set({ background: e.target.value })}
          />
        </label>
      </div>
      {resolved.ok ? (
        <p id="spec-summary" className="mt-3 text-neutral-600">
          Output: {resolved.spec.widthPx} x {resolved.spec.heightPx} px, JPG
        </p>
      ) : (
        <ul id="spec-errors" className="mt-3 list-disc pl-5 text-red-700">
          {resolved.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
