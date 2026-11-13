import { useState } from 'react'
import { AlertIcon, ChevronIcon } from './icons'
import type { Extension } from './pipeline/types'
import type { SpecFields } from './spec/fields'
import { parseInstructions } from './spec/instructions'
import type { Checked, FieldName, Suggestion } from './spec/feasibility'
import type { Unit } from './spec/units'

const UNITS: { value: Unit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
  { value: 'in', label: 'inch' },
  { value: 'px', label: 'px' },
]

/** Common sizes, named by the size alone: which form wants which is for the user to check. */
const PRESETS: Record<'photo' | 'signature', { label: string; fields: Partial<SpecFields> }[]> = {
  photo: [
    { label: '3.5 x 4.5 cm', fields: { width: '3.5', height: '4.5', unit: 'cm' } },
    { label: '2 x 2 inch', fields: { width: '2', height: '2', unit: 'in' } },
    { label: '200 x 230 px', fields: { width: '200', height: '230', unit: 'px' } },
  ],
  signature: [
    { label: '140 x 60 px', fields: { width: '140', height: '60', unit: 'px' } },
    { label: '3.5 x 1.5 cm', fields: { width: '3.5', height: '1.5', unit: 'cm' } },
    { label: '6 x 2 cm', fields: { width: '6', height: '2', unit: 'cm' } },
  ],
}

const FILE_TYPES: { value: Extension; label: string; hint: string }[] = [
  { value: 'jpg', label: 'JPG', hint: 'What most forms ask for. The file ends in .jpg' },
  { value: 'jpeg', label: 'JPEG', hint: 'The same as JPG, for portals that insist on .jpeg' },
  { value: 'png', label: 'PNG', hint: 'Only if the form asks for PNG: much larger files. The file ends in .png' },
]

const BACKGROUNDS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Light blue', value: '#dbeafe' },
  { label: 'Light grey', value: '#e5e7eb' },
]

const label = 'flex flex-col gap-1.5 text-sm font-semibold'
const group = 'text-soft text-xs font-bold tracking-wide'

interface Props {
  kind: 'photo' | 'signature'
  fields: SpecFields
  resolved: Checked
  /** Changes that would fix a problem or suit the picture better. */
  suggestions: Suggestion[]
  /** The boxes whose values cannot be met, to mark in red. */
  bad: FieldName[]
  onChange: (fields: SpecFields) => void
}

/** What the form asks for: size, unit, DPI, file size limits and background colour. */
export function SpecForm({ kind, fields, resolved, suggestions, bad, onChange }: Props) {
  const set = (patch: Partial<SpecFields>) => onChange({ ...fields, ...patch })
  const [pasted, setPasted] = useState('')
  // null until "Fill from text" has been pressed
  const [found, setFound] = useState<string[] | null>(null)

  function fillFromText() {
    const parsed = parseInstructions(pasted)
    setFound(parsed.found)
    set(parsed.fields)
  }

  // a box that cannot be met: red label, red ring
  const labelOf = (name: FieldName) => (bad.includes(name) ? `${label} nm-danger` : label)
  const boxOf = (name: FieldName) => (bad.includes(name) ? 'nm-field nm-field-bad' : 'nm-field')
  const invalid = (name: FieldName) => (bad.includes(name) ? true : undefined)

  const unitLabel = UNITS.find((unit) => unit.value === fields.unit)!.label
  const isPreset = (preset: Partial<SpecFields>) =>
    preset.width === fields.width && preset.height === fields.height && preset.unit === fields.unit

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <details className="card p-3">
        <summary className="flex items-center justify-between gap-2 rounded-md text-sm font-semibold">
          Paste the portal's instructions
          <span className="chevron">
            <ChevronIcon size={18} />
          </span>
        </summary>
        <p className="text-soft mt-2 text-xs">
          Paste the text and the boxes below are filled in for you. Always check them afterwards.
        </p>
        <textarea
          id="spec-paste"
          aria-label="The portal's instructions"
          className="nm-field mt-3 block h-24 resize-y !items-start !text-sm"
          placeholder="Dimensions 200 x 230 pixels, size between 20 KB and 50 KB"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button
          id="spec-fill"
          className="nm-btn mt-3"
          disabled={pasted.trim() === ''}
          onClick={fillFromText}
        >
          Fill from text
        </button>
        {found && (
          <p id="spec-found" className="mt-3 text-sm font-medium">
            {found.length > 0
              ? `Found: ${found.join(', ')}. Check the boxes below against the portal.`
              : 'Nothing recognised in that text. Fill in the boxes below by hand.'}
          </p>
        )}
      </details>

      <div className="flex flex-col gap-3">
        <p className={group}>SIZE</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS[kind].map((preset) => (
            <button
              key={preset.label}
              className={`nm-btn !min-h-9 !rounded-full !px-3 !text-xs ${isPreset(preset.fields) ? 'nm-btn-primary' : ''}`}
              aria-pressed={isPreset(preset.fields)}
              onClick={() => set(preset.fields)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelOf('width')}>
            Width
            <span className={boxOf('width')}>
              <input
                id="spec-width"
                aria-invalid={invalid('width')}
                inputMode="decimal"
                value={fields.width}
                onChange={(e) => set({ width: e.target.value })}
              />
              <span className="unit">{unitLabel}</span>
            </span>
          </label>
          <label className={labelOf('height')}>
            Height
            <span className={boxOf('height')}>
              <input
                id="spec-height"
                aria-invalid={invalid('height')}
                inputMode="decimal"
                value={fields.height}
                onChange={(e) => set({ height: e.target.value })}
              />
              <span className="unit">{unitLabel}</span>
            </span>
          </label>
          <label className={label}>
            Unit
            <span className="nm-field relative">
              <select
                id="spec-unit"
                className="cursor-pointer appearance-none pr-6"
                value={fields.unit}
                onChange={(e) => set({ unit: e.target.value as Unit })}
              >
                {UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3">
                <ChevronIcon size={16} />
              </span>
            </span>
          </label>
          <label className={labelOf('dpi')}>
            Print quality
            <span className={boxOf('dpi')}>
              <input
                id="spec-dpi"
                aria-invalid={invalid('dpi')}
                inputMode="numeric"
                disabled={fields.unit === 'px'}
                value={fields.dpi}
                onChange={(e) => set({ dpi: e.target.value })}
              />
              <span className="unit">DPI</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className={group}>FILE SIZE</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelOf('minKb')}>
            At least
            <span className={boxOf('minKb')}>
              <input
                id="spec-min-kb"
                aria-invalid={invalid('minKb')}
                inputMode="decimal"
                placeholder="Any"
                value={fields.minKb}
                onChange={(e) => set({ minKb: e.target.value })}
              />
              <span className="unit">KB</span>
            </span>
          </label>
          <label className={labelOf('maxKb')}>
            At most
            <span className={boxOf('maxKb')}>
              <input
                id="spec-max-kb"
                aria-invalid={invalid('maxKb')}
                inputMode="decimal"
                placeholder="Any"
                value={fields.maxKb}
                onChange={(e) => set({ maxKb: e.target.value })}
              />
              <span className="unit">KB</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className={group}>SAVE THE RESULT AS</p>
        <div
          className={`flex w-fit flex-wrap gap-2 rounded-full ${bad.includes('format') ? 'nm-field-bad' : ''}`}
          role="group"
          aria-label="File type of the result"
        >
          {FILE_TYPES.map((type) => (
            <button
              key={type.value}
              id={`spec-format-${type.value}`}
              className={`nm-btn !min-h-9 !rounded-full !px-4 !text-xs ${fields.format === type.value ? 'nm-btn-primary' : ''}`}
              aria-pressed={fields.format === type.value}
              title={type.hint}
              onClick={() => set({ format: type.value })}
            >
              {type.label}
            </button>
          ))}
        </div>
        <p className="text-soft text-xs">{FILE_TYPES.find((type) => type.value === fields.format)!.hint}.</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className={group}>BACKGROUND</p>
        <div className="flex items-center gap-3">
          {BACKGROUNDS.map((colour) => (
            <button
              key={colour.value}
              className="nm-swatch"
              style={{ background: colour.value }}
              aria-label={colour.label}
              title={colour.label}
              aria-pressed={fields.background.toLowerCase() === colour.value}
              onClick={() => set({ background: colour.value })}
            />
          ))}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              id="spec-background"
              className="nm-swatch cursor-pointer overflow-hidden p-0"
              type="color"
              aria-label="Another colour"
              value={fields.background}
              onChange={(e) => set({ background: e.target.value })}
            />
            Other
          </label>
        </div>
      </div>

      {resolved.ok ? (
        <>
          <p id="spec-summary" className="card px-3 py-2.5 text-sm font-semibold">
            <span className="text-soft font-medium">Your file will be </span>
            {resolved.spec.widthPx} x {resolved.spec.heightPx} px, {fields.format.toUpperCase()}
          </p>
          {resolved.cautions.length > 0 && (
            <ul id="spec-cautions" className="flex flex-col gap-2">
              {resolved.cautions.map((caution) => (
                <li key={caution} className="nm-note">
                  <AlertIcon />
                  {caution}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div id="spec-errors" role="alert" className="nm-danger card flex flex-col gap-2 p-3 text-sm font-medium">
          <p className="font-bold">This cannot be made yet</p>
          <ul className="list-disc pl-5">
            {resolved.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {suggestions.length > 0 && (
        <div id="spec-suggestions" className="flex flex-col gap-3">
          <p className={group}>SUGGESTED</p>
          {suggestions.map((suggestion) => (
            <div key={suggestion.action} className="card flex flex-col items-start gap-2.5 p-3">
              <p className="text-sm font-medium">{suggestion.text}</p>
              <button className="nm-btn !min-h-9 !text-xs" onClick={() => set(suggestion.patch)}>
                {suggestion.action}
              </button>
            </div>
          ))}
          <p className="text-soft text-xs">
            These suit your picture. If the portal gives its own numbers, those come first.
          </p>
        </div>
      )}
    </div>
  )
}
