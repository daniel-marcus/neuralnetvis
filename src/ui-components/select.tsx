interface SelectProps {
  ref: React.RefObject<HTMLSelectElement | null>
  options: string[]
  onChange?: (val: string, e?: React.ChangeEvent<HTMLSelectElement>) => void
}

export const Select = ({ ref, options, onChange }: SelectProps) => {
  return (
    <div className="relative flex-1">
      <select
        ref={ref}
        className="w-full appearance-none bg-transparent"
        onChange={(e) => {
          if (onChange) onChange(e.target.value, e)
        }}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
        <svg
          className="fill-current h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
        </svg>
      </div>
    </div>
  )
}
