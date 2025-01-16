"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Model } from "./model"
import { Leva } from "leva"
import { StatusText } from "./status-text"

export const App = () => {
  return (
    <div className="w-screen h-screen bg-[#110000]">
      <Canvas>
        <Lights />
        <OrbitControls />
        <Model />
      </Canvas>
      <Leva />
      <StatusText />
    </div>
  )
}

const Lights = () => (
  <>
    <ambientLight intensity={Math.PI / 2} />
    <spotLight
      position={[10, 10, 10]}
      angle={0.15}
      penumbra={1}
      decay={0}
      intensity={Math.PI}
    />
    <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
  </>
)
