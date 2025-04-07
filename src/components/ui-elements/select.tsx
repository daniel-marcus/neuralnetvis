import { ReactNode } from "react"
import { Arrow } from "./buttons"

type Option = {
  value: string
  label?: ReactNode
  disabled?: boolean
  selected?: boolean
}

interface SelectProps {
  ref?: React.RefObject<HTMLSelectElement | null>
  options: Option[]
  onChange?: (val: string, e?: React.ChangeEvent<HTMLSelectElement>) => void
  value?: string | number
  className?: string
  noArrow?: boolean
  label?: string
}

export const Select = ({
  ref,
  options,
  onChange,
  value,
  className = "",
  noArrow,
  label,
}: SelectProps) => {
  return (
    <div className="relative">
      <select
        value={value}
        ref={ref}
        className={`w-full input-appearance appearance-none bg-transparent pr-6! truncate ${className}`}
        onChange={(e) => {
          if (onChange) onChange(e.target.value, e)
        }}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label || o.value}
          </option>
        ))}
      </select>
      {!noArrow && (
        <div className="flex pointer-events-none absolute inset-y-0 right-0 items-center pl-2">
          <Arrow direction="down" />
        </div>
      )}
    </div>
  )
}
