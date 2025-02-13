import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useLockStore } from "@/scene/lock"
import { ThreeStoreSetter } from "./three-store"
import { DebugUtils } from "./debug-utils"
import { Model } from "./model"

export const Scene = () => {
  const isLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div
      className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
        isLocked ? "pointer-events-none" : ""
      }`}
    >
      <Canvas frameloop="demand">
        <Lights />
        <PerspectiveCamera makeDefault position={[-23, 0, 35]} />
        <OrbitControls target={[0, 0, 0]} enabled={!isLocked} />
        <ThreeStoreSetter />
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
