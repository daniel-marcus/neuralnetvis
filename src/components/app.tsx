"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import React, { ReactNode } from "react"
import { Model } from "../three-model/model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { useDebugStore } from "@/lib/debug"
import { Menu } from "./menu"
import { Footer } from "./footer"
import { ThreeStoreSetter } from "@/lib/three-store"
import { useLessonStore } from "./lesson"

export const App = ({ children }: { children?: ReactNode }) => {
  const [ds, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const [, batchCount] = useTraining(model, ds, next)
  const debug = useDebugStore((s) => s.debug)
  const isLearnMode = useLessonStore((s) => s.isLearnMoode())
  return (
    <div className="relative">
      <div
        className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
          isLearnMode ? "pointer-events-none" : ""
        }`}
      >
        <Canvas frameloop="demand">
          <ThreeStoreSetter />
          <Lights />
          <PerspectiveCamera makeDefault position={[-22.5, 0, 35]} />
          <OrbitControls target={[0, 0, 0]} enabled={!isLearnMode} />
          <Model model={model} batchCount={batchCount} isPending={isPending} />
          {debug && <Stats />}
        </Canvas>
        <Footer />
      </div>
      <div
        className={`absolute top-0 w-full h-[120vh] bg-gradient-to-b from-background to-transparent pointer-events-none ${
          isLearnMode ? "opacity-70" : "opacity-0"
        } transition-opacity duration-700`}
      />
      <Menu />
      {children}
    </div>
  )
}

const Lights = () => (
  <>
    <ambientLight intensity={Math.PI * 0.7} />
    <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
    <spotLight
      position={[-50, 10, -10]}
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
