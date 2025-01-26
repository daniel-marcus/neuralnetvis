"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import { Leva } from "leva"
import { StatusText } from "./status-text"
import { LevaCustomTheme } from "leva/dist/declarations/src/styles"
import LoadingSpinner from "./loading-spinner"
import React, { createContext } from "react"
import { Model } from "./model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { UiOptionsContext, useUiOptions } from "@/lib/ui-options"
import { useDebug } from "@/lib/_debug"

const levaTheme: LevaCustomTheme = {
  sizes: { numberInputMinWidth: "46px", controlWidth: "172px" },
}

export const TrainingYContext = createContext<number | undefined>(undefined)

export const App = () => {
  const [ds, isLoading, input, trainingY, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const uiOptions = useUiOptions(ds)
  useTraining(model, ds, next)
  const debug = useDebug((s) => s.debug)
  return (
    <div className="w-screen h-screen bg-[#110000]">
      <Canvas frameloop="always">
        <Lights />
        <PerspectiveCamera makeDefault position={[-22.5, 0, 35]} />
        <OrbitControls target={[6, 0, 0]} />
        <UiOptionsContext.Provider value={uiOptions}>
          <TrainingYContext.Provider value={trainingY}>
            <Model model={model} input={input} ds={ds} isPending={false} />
          </TrainingYContext.Provider>
        </UiOptionsContext.Provider>
        {debug && <Stats />}
      </Canvas>
      <Leva hideCopyButton theme={levaTheme} />
      <LoadingSpinner isActive={isLoading || isPending} />
      <StatusText />
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

/* 

*/
