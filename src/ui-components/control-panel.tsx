import { ReactNode, useState } from "react"
import { Collapsible } from "./collapsible"
import { Arrow } from "./buttons"

interface ControlPanelProps {
  children?: ReactNode
  title?: string
  variant?: "has-bg" | "no-bg"
  collapsed?: boolean
}

export const ControlPanel = ({
  children,
  title,
  variant = "has-bg",
  collapsed,
}: ControlPanelProps) => {
  const [isOpen, setIsOpen] = useState(!collapsed)
  return (
    <div className={`${variant === "has-bg" ? "bg-box-bg" : ""} rounded-box`}>
      {title && (
        <div className={`p-4 ${isOpen ? "text-white" : ""}`}>
          <button onClick={() => setIsOpen((o) => !o)}>
            <Arrow direction={isOpen ? "down" : "right"} />
            {title}
          </button>
        </div>
      )}
      <Collapsible isOpen={isOpen}>
        <div className="p-4 pt-0">
          <div className="pl-4 border-l border-menu-border flex flex-col gap-2 ">
            {children}
          </div>
        </div>
      </Collapsible>
    </div>
  )
}
