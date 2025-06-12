import { useLayoutEffect } from "react"
import { Button } from "@/contents/elements"
import { useCurrScene, useGlobalStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"

export const LockButton = () => {
  const isLocked = useCurrScene((s) => s.vis.isLocked)
  const toggleLocked = useCurrScene((s) => s.vis.toggleLocked)
  return (
    <Button onClick={toggleLocked} className="pointer-events-auto">
      {isLocked ? "Unlock visualization" : "Back to scrolling"}
    </Button>
  )
}

export function useLock() {
  const isLocked = useCurrScene((s) => s.vis.isLocked)
  const setVisConfig = useCurrScene((s) => s.vis.setConfig)
  const toggleLocked = useCurrScene((s) => s.vis.toggleLocked)
  const isDebug = useGlobalStore((s) => s.isDebug)
  useKeyCommand("l", toggleLocked, isDebug)
  useLayoutEffect(() => {
    setVisConfig({ isLocked: true })
    return () => {
      setVisConfig({ isLocked: false })
    }
  }, [setVisConfig])
  return isLocked
}
