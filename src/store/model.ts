import type { StateCreator } from "zustand"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { LayerActivations, LayerConfigArray } from "@/model"
import { StatusSlice } from "./status"
import { setVisConfig } from "."

export const defaultLayerConfigs: LayerConfigArray = [
  { className: "InputLayer", config: { batchInputShape: [null, 28, 28, 1] } },
  {
    className: "Dense",
    config: { units: 64, activation: "relu" },
  },
  { className: "Dense", config: { units: 10, activation: "softmax" } },
]

export interface ModelSlice {
  model?: LayersModel
  skipModelCreate: boolean // flag to skip model creation for loaded models
  _setModel: (model?: LayersModel) => void // for internal use; use modelTransition instead
  layerConfigs: LayerConfigArray
  setLayerConfigs: (layerConfigs: LayerConfigArray) => void
  resetLayerConfigs: () => void
  resetWeights: () => void
  getInputShape: () => number[]

  layerActivations: LayerActivations[]
  setLayerActivations: (layerActivations: LayerActivations[]) => void
}

export const createModelSlice: StateCreator<
  ModelSlice & StatusSlice,
  [],
  [],
  ModelSlice
> = (set, get) => ({
  model: undefined,
  skipModelCreate: false,
  _setModel: (model) => set({ model, layerActivations: [] }),
  layerConfigs: defaultLayerConfigs,
  setLayerConfigs: (layerConfigs) =>
    set(({ status }) => ({
      layerConfigs,
      status: { ...status, percent: -1 }, // trigger spinner
    })),
  resetLayerConfigs: () => {
    set({ layerConfigs: defaultLayerConfigs })
    setVisConfig({ invisibleLayers: [] })
  },
  resetWeights: () =>
    set(({ layerConfigs }) => ({ layerConfigs: [...layerConfigs] })), // trigger rebuild of model
  getInputShape: () => {
    const model = get().model
    if (!model) return []
    return model.layers[0].batchInputShape as number[]
  },

  layerActivations: [],
  setLayerActivations: (layerActivations) => set({ layerActivations }),
})
