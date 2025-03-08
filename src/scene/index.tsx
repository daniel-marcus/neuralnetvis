"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { defaultState } from "@/utils/initial-state"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { useGlobalStore, useSceneStore } from "@/store"

const { cameraPos, cameraLookAt } = defaultState

interface SceneProps {
  isActive: boolean
  dsKey?: string
}

export const Scene = (props: SceneProps) => {
  const isLocked = useSceneStore((s) => s.vis.isLocked)
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <Canvas
      frameloop="demand"
      resize={{ debounce: 0 }}
      className={`absolute w-screen! h-[100dvh]! select-none ${
        isLocked && !isDebug ? "pointer-events-none" : ""
      }`}
    >
      <SceneInner {...props} />
    </Canvas>
  )
}

export const SceneInner = ({ isActive, dsKey }: SceneProps) => {
  const { camera, invalidate } = useThree()
  useSpring({
    from: { zoom: 0.1 },
    to: { zoom: isActive ? 1 : 0.4 }, // TODO: adjust from screen size
    onChange: ({ value }) => {
      camera.zoom = value.zoom
      camera.updateProjectionMatrix()
      invalidate()
    },
  })
  return (
    <>
      <ThreeStoreSetter />
      <PerspectiveCamera makeDefault position={cameraPos} zoom={0.1} />
      <OrbitControls makeDefault target={cameraLookAt} enableZoom={isActive} />
      <DebugUtils />
      <Lights />
      <Model isActive={isActive} dsKey={dsKey} />
    </>
  )
}
