import { ReactNode } from "react"

interface InputRow {
  label?: string | ReactNode
  children?: ReactNode
  isDraggable?: boolean
  className?: string
}

export const InputRow = ({ label, children, className = "" }: InputRow) => (
  <div className={`flex gap-2 w-full leading-[1.5] ${className}`}>
    <div className="flex-none w-[7.5em]">{label ?? ""}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
)
