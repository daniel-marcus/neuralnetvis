import { MouseEvent, ReactNode, useId } from "react"
import { create } from "zustand"

interface HintStore {
  currHint: string
  setCurrHint: (id: string) => void
}

const useHintStore = create<HintStore>((set) => ({
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
  reset?: () => void
}

export const InputRow = (props: InputRowProps) => {
  const { label, children, className = "", hint, reset } = props
  const uid = useId()
  const { currHint, setCurrHint } = useHintStore()
  const showHint = currHint === uid
  const handleLabelClick = (e: MouseEvent) => {
    if (!hint) return
    if ("tagName" in e.target && e.target.tagName === "BUTTON") return
    setCurrHint(uid)
  }
  return (
    <div className={`relative flex gap-2 w-full leading-[1.5] ${className}`}>
      <div className={`flex-none w-[7.5em] flex justify-between`}>
        <div
          className={`w-full ${!!hint ? "cursor-pointer" : ""}`}
          onClick={handleLabelClick}
        >
          {label ?? ""}
        </div>
        {!!reset && (
          <button className="px-2" onClick={reset}>
            ↺
          </button>
        )}
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
