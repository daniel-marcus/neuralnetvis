interface TextInputProps {
  value: string
  onChange: (v: string) => void
}

export const TextInput = ({ value, onChange }: TextInputProps) => (
  <input
    type="string"
    className="w-full input-appearance"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
)
