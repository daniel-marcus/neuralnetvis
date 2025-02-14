import { useLayoutEffect } from "react"
import { Button } from "@/contents/elements"
import { useStore } from "@/store"

export const LockButton = () => {
  const isLocked = useStore((s) => s.vis.isLocked)
  const toggleLocked = useStore((s) => s.vis.toggleLocked)
  return (
    <Button onClick={toggleLocked} className="pointer-events-auto">
      {isLocked ? "Unlock visualization" : "Back to scrolling"}
    </Button>
  )
}

export function useLock() {
  const isLocked = useStore((s) => s.vis.isLocked)
  const setVisConfig = useStore((s) => s.vis.setConfig)
  useLayoutEffect(() => {
    setVisConfig({ isLocked: true })
    return () => {
      setVisConfig({ isLocked: false })
    }
  }, [setVisConfig])
  return isLocked
}
