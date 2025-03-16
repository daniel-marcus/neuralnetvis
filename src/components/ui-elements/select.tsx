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
}

export const Select = ({
  ref,
  options,
  onChange,
  value,
  className = "",
  noArrow,
}: SelectProps) => {
  return (
    <div className="relative flex-1">
      <select
        value={value}
        ref={ref}
        className={`w-full appearance-none bg-transparent ${className}`}
        onChange={(e) => {
          if (onChange) onChange(e.target.value, e)
        }}
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
