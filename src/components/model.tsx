import React, { createContext } from "react"
import { Sequential } from "./sequential"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { useSplitColors } from "@/lib/split-colors"

// TODO: move to app?
interface Options {
  hideLines?: boolean
  splitColors?: boolean
}

export const OptionsContext = createContext<Options>({})
export const TrainingYContext = createContext<number | undefined>(undefined)

export const Model = () => {
  const [ds, input, trainingY, next] = useDatasets()
  const model = useModel(ds)
  const [hideLines, splitColors] = useSplitColors(ds)
  const isTraining = useTraining(model, ds, next)
  return (
    <OptionsContext.Provider
      value={{ hideLines: hideLines || isTraining, splitColors }}
    >
      <TrainingYContext.Provider value={trainingY}>
        <Sequential model={model} input={input} ds={ds} />
      </TrainingYContext.Provider>
    </OptionsContext.Provider>
  )
}
