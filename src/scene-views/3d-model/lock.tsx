import { useEffect, useLayoutEffect, useRef } from "react"
import { Button } from "@/contents/elements"
import { getThree, useCurrScene, useGlobalStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { moveCameraTo, type Pos } from "./utils"

export const LockButton = () => {
  const isLocked = useCurrScene((s) => s.vis.isLocked)
  const toggleLocked = useCurrScene((s) => s.vis.toggleLocked)
  return (
    <Button onClick={toggleLocked} className="pointer-events-auto btn-mt">
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
  useFreeExploration(isLocked)
  return isLocked
}

type CameraState = { position: Pos; lookAt?: Pos }

// unlocked: explore freely like in play mode, relock: back to where the lesson was
function useFreeExploration(isLocked: boolean) {
  const setShowSampleViewer = useCurrScene((s) => s.setShowSampleViewer)
  const wasLocked = useRef(false)
  const savedCamera = useRef<CameraState | null>(null)
  useEffect(() => {
    const three = getThree()
    if (wasLocked.current && !isLocked && three) {
      const position = three.camera.position.toArray() as Pos
      const lookAt = three.controls?.target.toArray() as Pos | undefined
      savedCamera.current = { position, lookAt }
      setShowSampleViewer(true)
    } else if (!wasLocked.current && isLocked && savedCamera.current) {
      moveCameraTo(savedCamera.current.position, savedCamera.current.lookAt)
      savedCamera.current = null
      setShowSampleViewer(false)
    }
    wasLocked.current = isLocked
  }, [isLocked, setShowSampleViewer])
}
