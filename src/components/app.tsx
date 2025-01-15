"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { Model } from "./model"
import React, { createContext, useState } from "react"
import { Leva } from "leva"

type StatusTextSetter = React.Dispatch<React.SetStateAction<string>>
export const StatusTextContext = createContext<StatusTextSetter>(null!)

export const App = () => {
  const [statusText, setStatusText] = useState("")
  return (
    <StatusTextContext.Provider value={setStatusText}>
      <div className="w-screen h-screen bg-[#110000]">
        <Canvas>
          <ambientLight intensity={Math.PI / 2} />
          <spotLight
            position={[10, 10, 10]}
            angle={0.15}
            penumbra={1}
            decay={0}
            intensity={Math.PI}
          />
          <pointLight
            position={[-10, -10, -10]}
            decay={0}
            intensity={Math.PI}
          />
          <OrbitControls />
          <Model />
        </Canvas>
        <div
          className="fixed bottom-0 right-0 text-right text-sm p-4 text-white select-none max-w-[50%] overflow-auto"
          dangerouslySetInnerHTML={{ __html: statusText }}
        ></div>
        <Leva />
      </div>
    </StatusTextContext.Provider>
  )
}
