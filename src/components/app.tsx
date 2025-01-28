"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import { StatusText } from "./status-text"
import LoadingSpinner from "./loading-spinner"
import React, { createContext } from "react"
import { Model } from "./model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { VisOptionsContext, useVisOptions } from "@/lib/vis-options"
import { useDebug } from "@/lib/debug"
import { Console } from "./console"
import { Menu, withLevaStores } from "./menu"

export const TrainingYContext = createContext<number | undefined>(undefined)

const App_ = () => {
  const [ds, isLoading, input, trainingY, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const visOptions = useVisOptions(ds)
  const [isTraining, batchCount] = useTraining(model, ds, next)
  const debug = useDebug()
  return (
    <div className="w-screen h-screen bg-[#110000]">
      <Console />
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
              isPending={false}
              batchCount={batchCount}
            />
          </TrainingYContext.Provider>
        </VisOptionsContext.Provider>
        {debug && <Stats />}
      </Canvas>
      <Menu />
      <LoadingSpinner isActive={isLoading || isPending || isTraining} />
      <StatusText />
    </div>
  )
}

export const App = withLevaStores(App_)

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

/* 

*/
