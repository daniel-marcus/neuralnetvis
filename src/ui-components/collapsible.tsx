import { useEffect, useRef, useState } from "react"

interface CollapsibleProps {
  children?: React.ReactNode
  isOpen?: boolean
  maxHeight?: number
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
  useEffect(() => setHeight(ref.current?.scrollHeight ?? 0), [children])
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
