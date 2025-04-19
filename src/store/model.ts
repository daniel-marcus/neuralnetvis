import { setVisConfig } from "."
import type { StateCreator } from "zustand"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { DataSlice } from "./data"
import type { Evaluation } from "@/model"
import type { LayerConfigArray } from "@/model/layers/types"
import type { LayerStateful, Neuron, Nid } from "@/neuron-layers"
import type { ActivationStats } from "@/model/activation-stats"

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
  statefulLayers: LayerStateful[]
  setStatefulLayers: (statefulLayers: LayerStateful[]) => void

  allNeurons: Map<Nid, Neuron>
  setAllNeurons: (neurons: Map<Nid, Neuron>) => void

  evaluation: Evaluation
  setEvaluation: (props: Partial<Evaluation>) => void
  resetEvaluation: () => void
}

export const createModelSlice: StateCreator<
  ModelSlice & DataSlice,
  [],
  [],
  ModelSlice
> = (set) => ({
  backendReady: false,

  model: undefined,
  skipModelCreate: false,
  _setModel: (model) => {
    set({
      model,
      // sample: undefined,
      activationStats: undefined,
    })
  },
  layerConfigs: defaultLayerConfigs,
  setLayerConfigs: (layerConfigs) =>
    set(() => ({
      layerConfigs,
      // status: { ...status, percent: -1 }, // trigger spinner
    })),
  resetLayerConfigs: () => {
    set({ layerConfigs: [...defaultLayerConfigs] })
    setVisConfig({ invisibleLayers: [] })
  },
  resetWeights: () =>
    set(({ layerConfigs }) => ({ layerConfigs: [...layerConfigs] })), // trigger rebuild of model

  statefulLayers: [],
  setStatefulLayers: (statefulLayers) => set({ statefulLayers }),
  activationStats: undefined,
  setActivationStats: (activationStats) => set({ activationStats }),

  allNeurons: new Map(),
  setAllNeurons: (allNeurons) => set({ allNeurons }),

  evaluation: {},
  setEvaluation: (props) =>
    set((state) => ({
      evaluation: { ...state.evaluation, ...props },
    })),
  resetEvaluation: () => set({ evaluation: {} }),
})
