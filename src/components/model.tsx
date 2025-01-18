import React, { createContext } from "react"
import { Sequential } from "./sequential"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"

// TODO: move to app?
interface Options {
  hideLines?: boolean
}

export const OptionsContext = createContext<Options>({})
export const TrainingYContext = createContext<number | undefined>(undefined)

export const Model = () => {
  const [input, trainingY, next, ds] = useDatasets()
  const model = useModel(ds)
  const isTraining = useTraining(model, input, next, ds)
  if (!model) return null
  return (
    <OptionsContext.Provider value={{ hideLines: isTraining }}>
      <TrainingYContext.Provider value={trainingY}>
        <Sequential model={model} input={input} labelNames={ds.output.labels} />
      </TrainingYContext.Provider>
    </OptionsContext.Provider>
  )
}
