import { ReactNode } from "react"

interface InputRow {
  label?: string | ReactNode
  children?: ReactNode
  isDraggable?: boolean
}

export const InputRow = ({ label, children }: InputRow) => (
  <div className="flex gap-4 w-full">
    <div className="flex-none w-[7em]">{label ?? ""}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
)
