import { createPortal } from "react-dom"

interface PortalProps {
  target: React.RefObject<HTMLDivElement | null>
  children?: React.ReactNode
}

export function Portal({ target, children }: PortalProps) {
  if (!target.current) return null
  return createPortal(children, target.current)
}
