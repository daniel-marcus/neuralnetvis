interface CheckboxProps {
  checked: boolean
  onChange: (value: boolean) => void
  mark?: string // ◼ ●
}

export const Checkbox = ({ checked, onChange, mark = "◼" }: CheckboxProps) => (
  <button onClick={() => onChange(!checked)}>
    [
    <span
      className={`text-accent font-bold inline-block ${
        checked ? "" : "scale-0!"
      } transition-transform duration-100`}
    >
      {mark}
    </span>
    ]
  </button>
)
