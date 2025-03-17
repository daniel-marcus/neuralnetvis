import type { StateCreator } from "zustand"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { LayerConfigArray } from "@/model"
import { setVisConfig } from "."
import { Neuron, Nid } from "@/neuron-layers"
import { ActivationStats } from "@/model/activation-stats"

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

  activationStats?: ActivationStats[]
  setActivationStats: (activationStats?: ActivationStats[]) => void

  allNeurons: Map<Nid, Neuron>
  setAllNeurons: (neurons: Map<Nid, Neuron>) => void
}

export const createModelSlice: StateCreator<ModelSlice> = (set) => ({
  backendReady: false,

  model: undefined,
  skipModelCreate: false,
  _setModel: (model) => set({ model, activationStats: undefined }), // , layerActivations: []
  layerConfigs: defaultLayerConfigs,
  setLayerConfigs: (layerConfigs) =>
    set(() => ({
      layerConfigs,
      // status: { ...status, percent: -1 }, // trigger spinner
    })),
  resetLayerConfigs: () => {
    set({ layerConfigs: defaultLayerConfigs })
    setVisConfig({ invisibleLayers: [] })
  },
  resetWeights: () =>
    set(({ layerConfigs }) => ({ layerConfigs: [...layerConfigs] })), // trigger rebuild of model

  activationStats: undefined,
  setActivationStats: (activationStats) => set({ activationStats }),

  allNeurons: new Map(),
  setAllNeurons: (allNeurons) => set({ allNeurons }),
})
