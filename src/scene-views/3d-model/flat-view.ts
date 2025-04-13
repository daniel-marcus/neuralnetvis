import { useEffect, useRef } from "react"
import { useSceneStore } from "@/store"
import { getCameraPos, moveCameraTo } from "./utils"
import { defaultState } from "@/utils/initial-state"

const FLAT_VIEW_CAMERA_X = -40

export function useFlatView() {
  const isActive = useSceneStore((s) => s.vis.flatView)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const resetVisConfig = useSceneStore((s) => s.vis.reset)
  const lastFlatCameraX = useRef(FLAT_VIEW_CAMERA_X)
  useEffect(() => {
    if (!isActive) return
    const timeoutId = setTimeout(
      () => setVisConfig({ xShift: 0, yShift: -50, zShift: 0 }),
      1000
    )
    moveCameraTo([lastFlatCameraX.current, 0, 0], [0, 0, 0])
    return () => {
      clearTimeout(timeoutId)
      lastFlatCameraX.current = getCameraPos()?.[0] ?? FLAT_VIEW_CAMERA_X
      moveCameraTo(defaultState.cameraPos, [0, 0, 0])
      resetVisConfig("xShift")
      resetVisConfig("yShift")
      resetVisConfig("zShift")
    }
  }, [isActive, setVisConfig, resetVisConfig])
}
