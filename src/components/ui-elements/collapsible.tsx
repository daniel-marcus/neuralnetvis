import { ReactNode, useEffect, useRef, useState } from "react"
import { Arrow } from "./buttons"

interface CollapsibleWithTitleProps {
  children?: ReactNode
  title?: string
  variant?: "has-bg" | "no-bg"
  collapsed?: boolean
  border?: boolean
  className?: string
}

export const CollapsibleWithTitle = ({
  children,
  title,
  variant = "has-bg",
  collapsed,
  border = true,
  className = "",
}: CollapsibleWithTitleProps) => {
  const [isOpen, setIsOpen] = useState(!collapsed)
  return (
    <div
      className={`${
        variant === "has-bg" ? "bg-box-bg" : ""
      } rounded-box ${className}`}
    >
      {title && (
        <div className={`${isOpen ? "text-white" : ""}`}>
          <button
            onClick={() => setIsOpen((o) => !o)}
            className="w-full text-left p-4"
          >
            <Arrow direction={isOpen ? "down" : "right"} />
            {title}
          </button>
        </div>
      )}
      <Collapsible isOpen={isOpen}>
        <div className="p-4 pt-0">
          <div
            className={`${border ? "pl-4 border-l border-menu-border" : ""}`}
          >
            {children}
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

interface CollapsibleProps {
  children?: React.ReactNode
  isOpen?: boolean
  animate?: boolean
  className?: string
}

export function Collapsible({
  children,
  isOpen = true,
  animate = true,
  className = "",
}: CollapsibleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(500)
  useEffect(() => {
    if (ref.current?.scrollHeight) setHeight(ref.current?.scrollHeight ?? 0)
  }, [children])
  return (
    <div
      ref={ref}
      className={`transition-height ${
        isOpen ? "max-h-[var(--collapsible-max-h)]" : "max-h-0 overflow-hidden"
      } ${!animate ? "duration-0" : "duration-200"} ${className} ease-linear`}
      style={
        {
          "--collapsible-max-h": `${height + 100}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
