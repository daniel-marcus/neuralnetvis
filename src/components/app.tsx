"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import React, { createContext, ReactNode } from "react"
import { Model } from "./model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { VisOptionsContext, useVisOptions } from "@/lib/vis-options"
import { useDebugStore } from "@/lib/debug"
import { withControlStores } from "./controls"
import { Menu } from "./menu"
import { Controller } from "./controller"
import { Footer } from "./footer"
import { ThreeStoreSetter } from "@/lib/three-store"

export const TrainingYContext = createContext<number | undefined>(undefined)

const App_ = ({ children }: { children?: ReactNode }) => {
  const [ds, input, trainingY, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const visOptions = useVisOptions(ds)
  const [, batchCount] = useTraining(model, ds, next)
  const debug = useDebugStore((s) => s.debug)

  // TODO: find a way to determine if is play or learn mode ... + disable orbit controls in learn mode
  const isLearnMode = false

  return (
    <div className="relative">
      <Menu />
      <div
        className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-[#110000] select-none overflow-hidden ${
          !isLearnMode ? "pointer-events-none" : ""
        }`}
      >
        <Canvas frameloop="always">
          <ThreeStoreSetter />
          <Lights />
          <PerspectiveCamera makeDefault position={[-22.5, 0, 35]} />
          <OrbitControls target={[0, 0, 0]} />
          <VisOptionsContext.Provider value={visOptions}>
            <TrainingYContext.Provider value={trainingY}>
              <Model
                model={model}
                input={input}
                ds={ds}
                batchCount={batchCount}
                isPending={isPending}
              />
            </TrainingYContext.Provider>
          </VisOptionsContext.Provider>
          {debug && <Stats />}
          <Controller />
        </Canvas>
        <Footer />
      </div>
      {children}
    </div>
  )
}

export const App = withControlStores(App_)

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
