interface CheckboxProps {
  checked: boolean
  onChange: (value: boolean) => void
  mark?: string // ◼
}

export const Checkbox = ({ checked, onChange, mark = "◼" }: CheckboxProps) => (
  <button onClick={() => onChange(!checked)}>
    [
    <span
      className={`text-accent font-bold inline-block translate-y-[-0.1em] ${
        checked ? "" : "opacity-0"
      } transofrm-opacity duration-100`}
    >
      {mark}
    </span>
    ]
  </button>
)
