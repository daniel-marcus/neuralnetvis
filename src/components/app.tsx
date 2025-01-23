"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { Model } from "./model"
import { Leva } from "leva"
import { StatusText } from "./status-text"
import { LevaCustomTheme } from "leva/dist/declarations/src/styles"

const levaTheme: LevaCustomTheme = {
  sizes: { numberInputMinWidth: "46px", controlWidth: "172px" },
}

export const App = () => {
  return (
    <div className="w-screen h-screen bg-[#110000]">
      <Canvas>
        <Lights />
        <PerspectiveCamera makeDefault position={[-22.5, 0, 35]} />
        <OrbitControls target={[6, 0, 0]} />
        <Model />
      </Canvas>
      <Leva hideCopyButton theme={levaTheme} />
      <StatusText />
    </div>
  )
}

const Lights = () => (
  <>
    <ambientLight intensity={Math.PI * 0.7} />
    <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
    <spotLight
      position={[-30, 10, -10]}
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

/* 

*/
