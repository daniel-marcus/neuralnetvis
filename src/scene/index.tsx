"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { defaultState } from "@/utils/initial-state"
import { useStore } from "@/store"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { DatasetDef } from "@/data"

const { cameraPos, cameraLookAt } = defaultState

export const Scene = () => {
  const isLocked = useStore((s) => s.vis.isLocked)
  const isDebug = useStore((s) => s.isDebug)
  return (
    <div
      className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] select-none overflow-hidden ${
        isLocked && !isDebug ? "pointer-events-none" : ""
      }`}
    >
      <Canvas frameloop="demand">
        <ThreeStoreSetter />
        <PerspectiveCamera makeDefault position={cameraPos} />
        <OrbitControls
          makeDefault
          target={cameraLookAt}
          enabled={!isLocked || isDebug}
        />
        <DebugUtils />
        <Lights />
        <Model isActive={true} />
      </Canvas>
    </div>
  )
}

interface SceneInnerProps {
  isActive: boolean
  dsDef?: DatasetDef
}

export const SceneInner = ({ isActive, dsDef }: SceneInnerProps) => {
  const { camera, invalidate } = useThree()
  useSpring({
    zoom: isActive ? 1 : 0.4, // TODO: adjust from screen size
    onChange: ({ value }) => {
      camera.zoom = value.zoom
      camera.updateProjectionMatrix()
      invalidate()
    },
  })
  return (
    <>
      <ThreeStoreSetter />
      <PerspectiveCamera makeDefault position={cameraPos} zoom={0.4} />
      <OrbitControls makeDefault target={cameraLookAt} enableZoom={isActive} />
      <DebugUtils />
      <Lights />
      <Model isActive={isActive} dsDef={dsDef} />
    </>
  )
}
