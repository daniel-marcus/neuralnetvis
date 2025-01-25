import React, { createContext } from "react"
import { Sequential } from "./sequential"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { UiOptionsContext, useUiOptions } from "@/lib/ui-options"

export const TrainingYContext = createContext<number | undefined>(undefined)

export const Model = () => {
  const [ds, input, trainingY, next] = useDatasets()
  const model = useModel(ds)
  const uiOptions = useUiOptions(ds)
  useTraining(model, ds, next)
  if (!model) return null
  return (
    <UiOptionsContext.Provider value={uiOptions}>
      <TrainingYContext.Provider value={trainingY}>
        <Sequential model={model} input={input} ds={ds} />
      </TrainingYContext.Provider>
    </UiOptionsContext.Provider>
  )
}
