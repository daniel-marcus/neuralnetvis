import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { defaultState } from "@/utils/initial-state"
import { useStore } from "@/store"

const { cameraPos, cameraLookAt } = defaultState

export const Scene = () => {
  const isLocked = useStore((s) => s.vis.isLocked)
  const isDebug = useStore((s) => s.isDebug)
  return (
    <div
      className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
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

const Lights = () => (
  <>
    <ambientLight intensity={Math.PI * 0.7} />
    <spotLight
      position={[-100, 20, -20]}
      angle={Math.PI / 3}
      penumbra={1}
      decay={0}
      intensity={Math.PI}
    />
    <spotLight
      position={[100, -20, 20]}
      angle={Math.PI / 3}
      penumbra={1}
      decay={0}
      intensity={(Math.PI / 3) * 2}
      // color="rgb(100,20,255)"
      color="#ff0000"
    />
  </>
)
