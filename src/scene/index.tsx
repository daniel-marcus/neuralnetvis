import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { DebugUtils } from "./debug-utils"
import { defaultState } from "@/utils/initial-state"
import { useStore } from "@/store"

export const Scene = () => {
  const isLocked = useStore((s) => s.vis.isLocked)
  return (
    <div
      className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
        isLocked ? "pointer-events-none" : ""
      }`}
    >
      <Canvas frameloop="demand">
        <Lights />
        <PerspectiveCamera makeDefault position={defaultState.cameraPos} />
        <OrbitControls target={[0, 0, 0]} enabled={!isLocked} />
        <DebugUtils />
        <Model />
      </Canvas>
    </div>
  )
}

const Lights = () => (
  <>
    <ambientLight intensity={Math.PI * 0.7} />
    <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
    <spotLight
      position={[-100, 10, -10]}
      angle={Math.PI / 3}
      penumbra={1}
      decay={0}
      intensity={Math.PI}
    />
    <spotLight
      position={[30, 10, 15]}
      angle={Math.PI / 3}
      penumbra={1}
      decay={0}
      intensity={(Math.PI / 3) * 2}
      color="#ff0000"
    />
  </>
)
