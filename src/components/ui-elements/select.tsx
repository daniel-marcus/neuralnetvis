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

/*
<svg
          className="fill-current h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>

*/
