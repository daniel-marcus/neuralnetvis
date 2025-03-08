import { useLayoutEffect } from "react"
import { Button } from "@/contents/elements"
import { useGlobalStore } from "@/store"

export const LockButton = () => {
  const isLocked = useGlobalStore((s) => s.vis.isLocked)
  const toggleLocked = useGlobalStore((s) => s.vis.toggleLocked)
  return (
    <Button onClick={toggleLocked} className="pointer-events-auto">
      {isLocked ? "Unlock visualization" : "Back to scrolling"}
    </Button>
  )
}

export function useLock() {
  const isLocked = useGlobalStore((s) => s.vis.isLocked)
  const setVisConfig = useGlobalStore((s) => s.vis.setConfig)
  useLayoutEffect(() => {
    setVisConfig({ isLocked: true })
    return () => {
      setVisConfig({ isLocked: false })
    }
  }, [setVisConfig])
  return isLocked
}
