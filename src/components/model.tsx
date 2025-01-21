import React, { createContext } from "react"
import { Sequential } from "./sequential"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { create } from "zustand"

// TODO: move to app?
interface Options {
  hideLines?: boolean
}

export const OptionsContext = createContext<Options>({})
export const TrainingYContext = createContext<number | undefined>(undefined)

type NodeId = string // layerIndex_nodeIndex

export const useSelectedNodes = create<{
  selectedNode: NodeId | null
  toggleNode: (nodeId: NodeId) => void
}>((set) => ({
  selectedNode: null,
  toggleNode: (nodeId) =>
    set(({ selectedNode }) => ({
      selectedNode: selectedNode === nodeId ? null : nodeId,
    })),
}))

export const Model = () => {
  const [input, rawInput, trainingY, next, ds] = useDatasets()
  const model = useModel(ds)
  const isTraining = useTraining(model, input, next, ds)
  if (!model) return null
  return (
    <OptionsContext.Provider value={{ hideLines: isTraining }}>
      <TrainingYContext.Provider value={trainingY}>
        <Sequential model={model} input={input} rawInput={rawInput} ds={ds} />
      </TrainingYContext.Provider>
    </OptionsContext.Provider>
  )
}
