"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { useGlobalStore, useSceneStore } from "@/store"
import { useIsTouchDevice } from "@/utils/screen"
import { defaultState } from "@/utils/initial-state"

interface SceneProps {
  isActive: boolean
  dsKey?: string
}

export const Scene = (props: SceneProps) => {
  const { isActive } = props
  const isLocked = useSceneStore((s) => s.vis.isLocked)
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <Canvas
      frameloop="demand"
      resize={{ debounce: 0 }}
      className={`absolute w-screen! h-[100dvh]! select-none ${
        isActive ? "" : "touch-pinch-zoom! touch-pan-y!"
      } ${isLocked && !isDebug ? "pointer-events-none!" : ""}`}
    >
      <SceneInner {...props} />
    </Canvas>
  )
}

export const SceneInner = ({ isActive }: SceneProps) => {
  const { camera, invalidate } = useThree()
  useSpring({
    from: { zoom: 0.1 },
    to: { zoom: isActive ? 1 : 0.38 }, // TODO: adjust from screen size
    onChange: ({ value }) => {
      camera.zoom = value.zoom
      camera.updateProjectionMatrix()
      invalidate()
    },
  })
  const isTouchDevice = useIsTouchDevice()
  return (
    <>
      <ThreeStoreSetter />
      <PerspectiveCamera
        makeDefault
        position={defaultState.cameraPos}
        zoom={0.1}
      />
      <OrbitControls
        makeDefault
        target={defaultState.cameraLookAt}
        enableZoom={isActive || isTouchDevice}
        minPolarAngle={isActive || !isTouchDevice ? 0 : Math.PI / 2}
        maxPolarAngle={isActive || !isTouchDevice ? Math.PI : Math.PI / 2}
        rotateSpeed={isActive ? 1 : 1.5}
      />
      <DebugUtils />
      <Lights />
      <Model />
    </>
  )
}
