import { useEffect, useRef } from "react"
import { getVisConfig, useSceneStore } from "@/store"
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
    // remember shift values to restore in cleanup
    const xShift = getVisConfig("xShift")
    const yShift = getVisConfig("yShift")
    const zShift = getVisConfig("zShift")

    const timeoutId = setTimeout(
      // when wheel browsing is finished, spread layers on y axis for flat transitions
      () => setVisConfig({ xShift: 0, yShift: -30, zShift: 0 }),
      1500
    )
    moveCameraTo([lastFlatCameraX.current, 0, 0], [0, 0, 0])
    return () => {
      clearTimeout(timeoutId)
      lastFlatCameraX.current = getCameraPos()?.[0] ?? FLAT_VIEW_CAMERA_X
      moveCameraTo(defaultState.cameraPos, [0, 0, 0])
      setVisConfig({ xShift, yShift, zShift })
    }
  }, [isActive, setVisConfig, resetVisConfig])
}
