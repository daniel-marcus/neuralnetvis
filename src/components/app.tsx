"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import { Status } from "./status"
import React, { createContext } from "react"
import { Model } from "./model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { VisOptionsContext, useVisOptions } from "@/lib/vis-options"
import { useDebugStore } from "@/lib/debug"
import { withControlStores } from "./controls"
import { Leva } from "leva"
import { Menu } from "./menu"
import { ProgressBar } from "./progress-bar"

export const TrainingYContext = createContext<number | undefined>(undefined)

const App_ = () => {
  const [ds, input, trainingY, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const visOptions = useVisOptions(ds)
  const [, batchCount] = useTraining(model, ds, next)
  const debug = useDebugStore((s) => s.debug)
  return (
    <div className="w-screen h-screen bg-[#110000]">
      <Canvas frameloop="demand">
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
      </Canvas>
      <Menu />
      <Status>
        <ProgressBar isSpinner={isPending} />
      </Status>
      <Leva hidden />
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
