"use client"

import { useContext, useRef } from "react"
import * as THREE from "three/webgpu"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { SceneContext, useGlobalStore, useSceneStore } from "@/store"
import { useFlatView } from "./flat-view"
import { isTouch, useIsScreen } from "@/utils/screen"
import { defaultState, InitialState } from "@/utils/initial-state"
import { getTileDuration, useHasActiveTile } from "@/components/tile-grid"
import { Graph } from "../graph"
import { useKeyCommand } from "@/utils/key-command"
import { View } from "./view"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

interface CanvasViewProps {
  isActive: boolean
  tileIdx: number
  dsKey?: string
  ownCanvas?: boolean
  initialState?: InitialState
}

// CanvasRenderTarget might be interesting: https://github.com/mrdoob/three.js/pull/27628

export const CanvasView = (props: CanvasViewProps) => {
  const { isActive, ownCanvas } = props
  const isMapView = useSceneStore((s) => s.view === "map")
  const hasActive = useHasActiveTile()
  const invisible = (hasActive && !isActive) || isMapView
  const gpuDevice = useGlobalStore((s) => s.gpuDevice)
  const store = useContext(SceneContext) // needs to be passed inside the View component
  const setHasRendered = useSceneStore((s) => s.setHasRendered)
  if (typeof gpuDevice === null) return null // not initialized yet
  if (!ownCanvas)
    // only scenes with a map background get their own canvas (for correct stacking context), all others use a View to the MainCanvas
    return (
      <View
        className={`absolute w-full h-full select-none ${
          isActive ? "" : "touch-pan-y!"
        } ${invisible ? "pointer-events-none opacity-0" : ""}`}
        visible={!invisible}
        index={props.tileIdx + 1} // for debug only
        // copyCanvas={props.copyCanvas}
        onFirstRender={setHasRendered}
      >
        <SceneContext.Provider value={store}>
          <CanvasViewInner {...props} />
        </SceneContext.Provider>
      </View>
    )
  else
    return (
      <Canvas
        frameloop="demand"
        gl={async (renderProps) => {
          const renderer = new THREE.WebGPURenderer({
            ...(renderProps as WebGPURendererParameters),
            device: gpuDevice ? gpuDevice : undefined,
          })
          await renderer.init()
          return renderer
        }}
        onCreated={setHasRendered}
        className={`absolute! will-change-transform w-screen! h-screen! ${
          isActive ? "" : "touch-pan-y!"
        } ${isMapView ? "pointer-events-none!" : ""} ${
          isMapView ? "opacity-0" : ""
        } transition-opacity duration-300`}
      >
        <CanvasViewInner {...props} />
      </Canvas>
    )
}

const CanvasViewInner = (props: CanvasViewProps) => {
  const { isActive, initialState, ownCanvas } = props
  const invalidate = useThree((s) => s.invalidate)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const isScreenSm = useIsScreen("sm")
  const inactiveZoom = ownCanvas ? 0.4 : 0.9
  useSpring({
    from: { zoom: 0.1 },
    to: { zoom: isActive ? (isScreenSm ? 1 : 0.5) : inactiveZoom },
    onChange: ({ value }) => {
      const camera = cameraRef.current
      if (camera) {
        camera.zoom = value.zoom
        camera.updateProjectionMatrix()
        invalidate()
      }
    },
    config: { duration: getTileDuration() },
  })
  useFlatView()

  const view = useSceneStore((s) => s.view)
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const autoRotate = useSceneStore((s) => s.vis.autoRotate)
  const toggleAutoRotate = useSceneStore((s) => s.vis.toggleAutoRotate)
  useKeyCommand("r", toggleAutoRotate, isActive)

  return (
    <>
      <ThreeStoreSetter />
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={initialState?.cameraPos ?? defaultState.cameraPos}
        zoom={0.1}
        far={5000}
      />
      <OrbitControls
        makeDefault
        target={initialState?.cameraLookAt ?? defaultState.cameraLookAt}
        enableZoom={!visIsLocked && (isActive || isTouch())}
        enableRotate={!visIsLocked}
        enablePan={!visIsLocked}
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
