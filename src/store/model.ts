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

interface TfModelSlice {
  model?: LayersModel
  skipModelCreation: boolean // flag to skip model creation for loaded models
  _setModel: (model?: LayersModel) => void // for internal use; use modelTransition instead
  layerConfigs: LayerConfigArray
  resetLayerConfigs: () => void
  resetWeights: () => void
}

export const createTfModelSlice: StateCreator<TfModelSlice> = (set) => ({
  model: undefined,
  skipModelCreation: false,
  _setModel: (model) => set({ model }),
  layerConfigs: defaultLayerConfigs,
  resetLayerConfigs: () => set({ layerConfigs: defaultLayerConfigs }),
  resetWeights: () =>
    set(({ layerConfigs }) => ({ layerConfigs: [...layerConfigs] })), // trigger rebuild of model
})

export interface ActivationsSlice {
  layerActivations: LayerActivations[]
  setLayerActivations: (layerActivations: LayerActivations[]) => void
}
const createActivationsSlice: StateCreator<ActivationsSlice> = (set) => ({
  layerActivations: [],
  setLayerActivations: (layerActivations) => set(() => ({ layerActivations })),
})

export type ModelSlice = TfModelSlice & ActivationsSlice

export const createModelSlice: StateCreator<ModelSlice> = (...a) => ({
  ...createTfModelSlice(...a),
  ...createActivationsSlice(...a),
})
