import { ReactNode, useId } from "react"
import { create } from "zustand"

const useHintStore = create<{
  currHint: string
  setCurrHint: (id: string) => void
}>((set) => ({
  currHint: "",
  setCurrHint: (id) =>
    set((state) => ({ currHint: state.currHint === id ? "" : id })),
}))

interface InputRowProps {
  label?: string | ReactNode
  children?: ReactNode
  isDraggable?: boolean
  className?: string
  hint?: string
}

export const InputRow = (props: InputRowProps) => {
  const { label, children, className = "", hint } = props
  const { currHint, setCurrHint } = useHintStore()
  const uid = useId()
  const onLabelClick = !!hint ? () => setCurrHint(uid) : undefined
  const showHint = currHint === uid
  return (
    <div className={`relative flex gap-2 w-full leading-[1.5] ${className}`}>
      <div
        className={`flex-none w-[7.5em] ${!!hint ? "cursor-pointer" : ""}`}
        onClick={onLabelClick}
      >
        {label ?? ""}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      {showHint && <Hint>{hint}</Hint>}
    </div>
  )
}

const Hint = ({ children }: { children: ReactNode }) => (
  <div className="absolute z-10 w-2/3 left-0 top-[calc(100%+0.5em)] bg-background text-xs p-3 rounded-btn shadow-md">
    {children}
  </div>
)
