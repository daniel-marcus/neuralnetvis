"use client"

import { useContext, useRef } from "react"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { Lights } from "./lights"
import { ThreeStoreSetter } from "./three-store-setter"
import { useSpring } from "@react-spring/web"
import { SceneContext, useGlobalStore, useSceneStore } from "@/store"
import { useFlatView } from "./flat-view"
import { isTouch } from "@/utils/screen"
import { defaultState } from "@/utils/initial-state"
import { getTileDuration, useHasActiveTile } from "@/components/tile-grid"
import { Graph } from "../graph"
import { useKeyCommand } from "@/utils/key-command"
import { View } from "./view"

interface CanvasViewProps {
  isActive: boolean
  tileIdx: number
  dsKey?: string
  copyCanvas?: boolean
}

// CanvasRenderTarget might be interesting: https://github.com/mrdoob/three.js/pull/27628

export const CanvasView = (props: CanvasViewProps) => {
  const { isActive } = props
  const isMapView = useSceneStore((s) => s.view === "map")
  const hasActive = useHasActiveTile()
  const invisible = (hasActive && !isActive) || isMapView
  const gpuDevice = useGlobalStore((s) => s.gpuDevice)
  const store = useContext(SceneContext) // needs to be passed inside the View component
  if (typeof gpuDevice === null) return null // not initialized yet
  return (
    <View
      className={`absolute w-full h-full select-none ${
        // TODO: resize during tile transition
        isActive ? "" : "touch-pan-y!"
      }`}
      visible={!invisible}
      index={props.tileIdx + 1} // for debug only
      copyCanvas={props.copyCanvas}
    >
      <SceneContext.Provider value={store}>
        <CanvasViewInner {...props} />
      </SceneContext.Provider>
    </View>
  )
}

/* 

    <Canvas
      frameloop="demand"
      gl={async (renderProps) => {
        const renderer = new THREE.WebGPURenderer({
          ...(renderProps as WebGPURendererParameters),
          device: gpuDevice ? gpuDevice : undefined,
          // forceWebGL: true,
        })
        await renderer.init()
        return renderer
      }}
      className={`absolute! w-screen! h-[100vh]! select-none ${
        isActive ? "" : "touch-pan-y!"
      } ${(isLocked || isMapView) && !isDebug ? "pointer-events-none!" : ""} ${
        isMapView ? "opacity-0" : ""
      } transition-opacity duration-300`}
    >
      <CanvasViewInner {...props} />
    </Canvas>
*/

const CanvasViewInner = ({ isActive }: CanvasViewProps) => {
  const invalidate = useThree((s) => s.invalidate)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  // const isScreenSm = useIsScreen("sm")
  useSpring({
    from: { zoom: 0.1 },
    to: { zoom: isActive ? 1 : 0.9 }, // kept to trigger invalidation?
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
  const autoRotate = useSceneStore((s) => s.vis.autoRotate)
  const toggleAutoRotate = useSceneStore((s) => s.vis.toggleAutoRotate)
  useKeyCommand("r", toggleAutoRotate, isActive)

  return (
    <>
      <ThreeStoreSetter />
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={defaultState.cameraPos}
        zoom={0.1}
        far={5000}
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
