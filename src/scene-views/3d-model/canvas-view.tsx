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
import { defaultState, type InitialState } from "@/utils/initial-state"
import { getTileDuration, useHasActiveTile } from "@/components/tile-grid-data"
import { Graph } from "../graph"
import { useKeyCommand } from "@/utils/key-command"
import { isWebGPUBackend, useIsWebGPU } from "@/utils/webgpu"
import { ScissorView } from "./scissor-view"
import { CanvasTargetView } from "./canvas-target-view"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

interface CanvasViewProps {
  isActive: boolean
  tileIdx: number
  dsKey?: string
  ownCanvas?: boolean
  initialState?: InitialState
}

export const CanvasView = (props: CanvasViewProps) => {
  const { isActive, ownCanvas } = props
  const isMapView = useSceneStore((s) => s.view === "map")
  const hasActive = useHasActiveTile()
  const invisible = (hasActive && !isActive) || isMapView
  const gpuDevice = useGlobalStore((s) => s.gpuDevice)
  const store = useContext(SceneContext) // needs to be passed inside the View component
  const setHasRendered = useSceneStore((s) => s.setHasRendered)
  const mainRenderer = useGlobalStore((s) => s.renderer)
  if (gpuDevice === null || !mainRenderer) return null // not initialized yet
  const isWebGPU = isWebGPUBackend(mainRenderer.backend)
  if (isWebGPU)
    return (
      <CanvasTargetView
        className={`absolute w-screen h-screen select-none ${
          isActive ? "" : "touch-pan-y!"
        } ${invisible ? "pointer-events-none opacity-0" : ""}`}
        onFirstRender={setHasRendered}
        visible={!invisible}
        index={props.tileIdx + 1}
      >
        <SceneContext.Provider value={store}>
          <CanvasViewInner {...props} ownCanvas={true} />
        </SceneContext.Provider>
      </CanvasTargetView>
    )
  // fallback for WebGLBackend:
  // a) ScissorView (sharing MainCanvas)
  // b) separate Canvas (only for scenes with map background for correct stacking context)
  if (!ownCanvas)
    return (
      <ScissorView
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
      </ScissorView>
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
  const isWebGPU = useIsWebGPU()
  const scene = useThree((s) => s.scene)
  const domElement = isWebGPU ? scene.userData.canvasTarget?.domElement : undefined

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
        domElement={domElement}
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
