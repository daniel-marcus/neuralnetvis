import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { defaultState } from "@/utils/initial-state"
import { useStore } from "@/store"
import { Lights } from "./lights"

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
        <Lights />
        <PerspectiveCamera makeDefault position={cameraPos} />
        <OrbitControls
          makeDefault
          target={cameraLookAt}
          enabled={!isLocked || isDebug}
        />
        <DebugUtils />
        <Model />
      </Canvas>
    </div>
  )
}
