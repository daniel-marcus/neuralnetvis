import { useEffect, useRef } from "react"
import { useThree } from "@react-three/fiber"
import { getVisConfig, useSceneStore } from "@/store"
import { moveCameraTo } from "./utils"
import { defaultState } from "@/utils/initial-state"
import type { OrbitControls } from "three-stdlib"

const FLAT_VIEW_CAMERA_X = -40

export function useFlatView() {
  const isActive = useSceneStore((s) => s.vis.flatView)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const resetVisConfig = useSceneStore((s) => s.vis.reset)
  const lastFlatCameraX = useRef(FLAT_VIEW_CAMERA_X)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControls
  useEffect(() => {
    if (!isActive) return
    // remember shift values to restore in cleanup
    const xShift = getVisConfig("xShift")
    const yShift = getVisConfig("yShift")
    const zShift = getVisConfig("zShift")
    const oldCameraPos = camera.position.toArray()
    const oldCameraLookAt = controls?.target.toArray()

    const timeoutId = setTimeout(
      // when wheel browsing is finished, spread layers on y axis for flat transitions
      () => setVisConfig({ xShift: 0, yShift: -30, zShift: 0 }),
      1500
    )
    moveCameraTo([lastFlatCameraX.current, 0, 0], [0, 0, 0])
    return () => {
      clearTimeout(timeoutId)
      lastFlatCameraX.current =
        camera.position.toArray()[0] ?? FLAT_VIEW_CAMERA_X
      moveCameraTo(
        oldCameraPos ?? defaultState.cameraPos,
        oldCameraLookAt ?? defaultState.cameraLookAt
      )
      setVisConfig({ xShift, yShift, zShift })
    }
  }, [isActive, setVisConfig, resetVisConfig, camera, controls])
}
