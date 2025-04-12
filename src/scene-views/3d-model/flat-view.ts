import { useEffect } from "react"
import { useSceneStore } from "@/store"
import { moveCameraTo } from "./utils"
import { defaultState } from "@/utils/initial-state"

export function useFlatView() {
  const isActive = useSceneStore((s) => s.vis.flatView)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const resetVisConfig = useSceneStore((s) => s.vis.reset)
  useEffect(() => {
    if (!isActive) return
    setVisConfig({ xShift: 0, yShift: -50, zShift: 0 })
    moveCameraTo([-40, 0, 0], [0, 0, 0])
    return () => {
      moveCameraTo(defaultState.cameraPos, [0, 0, 0])
      resetVisConfig("xShift")
      resetVisConfig("yShift")
      resetVisConfig("zShift")
    }
  }, [isActive, setVisConfig, resetVisConfig])
}
