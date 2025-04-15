"use client"

import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { useGlobalStore, useSceneStore } from "@/store"
import { useFlatView } from "./flat-view"
import { useIsScreen, isTouch } from "@/utils/screen"
import { defaultState } from "@/utils/initial-state"
import { getTileDuration } from "@/components/tile-grid"
import { Graph } from "../graph"
import { useKeyCommand } from "@/utils/key-command"

interface CanvasProps {
  isActive: boolean
  dsKey?: string
}

export const ThreeCanvas = (props: CanvasProps) => {
  const { isActive } = props
  const isLocked = useSceneStore((s) => s.vis.isLocked)
  const isMapView = useSceneStore((s) => s.view === "map")
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <Canvas
      frameloop="demand"
      // resize={{ debounce: 0 }}
      className={`absolute! w-screen! h-[100vh]! select-none ${
        isActive ? "" : "touch-pan-y!"
      } ${(isLocked || isMapView) && !isDebug ? "pointer-events-none!" : ""} ${
        isMapView ? "opacity-0" : ""
      } transition-opacity duration-300`}
    >
      <CanvasInner {...props} />
    </Canvas>
  )
}

export const CanvasInner = ({ isActive }: CanvasProps) => {
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const isScreenSm = useIsScreen("sm")
  useSpring({
    from: { zoom: 0.1 },
    to: { zoom: isActive ? (isScreenSm ? 1 : 0.5) : 0.4 }, // TODO: adjust from screen size
    onChange: ({ value }) => {
      camera.zoom = value.zoom
      camera.updateProjectionMatrix()
      invalidate()
    },
    config: { duration: getTileDuration() },
  })
  useFlatView()

  const view = useSceneStore((s) => s.view)
  const autoRotate = useSceneStore((s) => s.vis.autoRotate)
  const toggleAutoRotate = useSceneStore((s) => s.vis.toggleAutoRotate)
  useKeyCommand("r", toggleAutoRotate, isActive)

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
        enableZoom={isActive || isTouch()}
        minPolarAngle={isActive || !isTouch() ? 0 : Math.PI / 2}
        maxPolarAngle={isActive || !isTouch() ? Math.PI : Math.PI / 2}
        rotateSpeed={isActive ? 1 : 1.5}
        autoRotate={autoRotate}
      />
      <DebugUtils />
      <Lights />
      {view === "graph" ? <Graph /> : <Model />}
    </>
  )
}
