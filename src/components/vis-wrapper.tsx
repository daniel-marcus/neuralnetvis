import { ReactNode } from "react"
import { useLockStore } from "./lock"

export const VisWrapper = ({ children }: { children: ReactNode }) => {
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div
      className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
        visualizationLocked ? "pointer-events-none" : ""
      }`}
    >
      {children}
    </div>
  )
}
