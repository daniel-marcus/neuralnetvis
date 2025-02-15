import type { StateCreator } from "zustand"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { LayerActivations, LayerConfig, LayerConfigArray } from "@/model"

const defaultLayerConfigs: LayerConfig<"Dense">[] = [
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
  resetLayerConfigs: () => void
  resetWeights: () => void

  layerActivations: LayerActivations[]
  setLayerActivations: (layerActivations: LayerActivations[]) => void
}

export const createModelSlice: StateCreator<ModelSlice> = (set) => ({
  model: undefined,
  skipModelCreate: false,
  _setModel: (model) => set({ model, layerActivations: [] }),
  layerConfigs: defaultLayerConfigs,
  resetLayerConfigs: () => set({ layerConfigs: defaultLayerConfigs }),
  resetWeights: () =>
    set(({ layerConfigs }) => ({ layerConfigs: [...layerConfigs] })), // trigger rebuild of model

  layerActivations: [],
  setLayerActivations: (layerActivations) => set(() => ({ layerActivations })),
})
