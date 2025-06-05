import { setVisConfig } from "."
import type { StateCreator } from "zustand"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { DataSlice } from "./data"
import type { Evaluation, LayerActivations } from "@/model"
import type { LayerConfigArray } from "@/model/layers/types"
import type { ActivationStats } from "@/model/activation-stats"
import { ViewSlice } from "./view"

export interface ModelSlice {
  model?: LayersModel
  skipModelCreate: boolean // flag to skip model creation for loaded models
  _setModel: (model?: LayersModel) => void // for internal use; use modelTransition instead
  layerConfigs: LayerConfigArray | null
  setLayerConfigs: (layerConfigs: LayerConfigArray) => void
  resetLayerConfigs: () => void
  resetWeights: () => void

  activationStats: { [layerIdx: number]: ActivationStats | undefined }
  setActivationStats: (
    activationStats?: Record<number, ActivationStats>
  ) => void

  activations: {
    [layerIdx: number]: LayerActivations | undefined
  }
  setActivations: (activations: Record<number, LayerActivations>) => void

  evaluation: Evaluation
  setEvaluation: (props: Partial<Evaluation>) => void
  resetEvaluation: () => void
}

export const createModelSlice: StateCreator<
  ModelSlice & DataSlice & ViewSlice,
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
      activationStats: {},
      activations: {},
      focussedLayerIdx: undefined,
    })
  },
  layerConfigs: null,
  setLayerConfigs: (layerConfigs) =>
    set(() => ({
      layerConfigs,
      // status: { ...status, percent: -1 }, // trigger spinner
    })),
  resetLayerConfigs: () => {
    set({ layerConfigs: null })
    setVisConfig({ excludedLayers: [] })
  },
  resetWeights: () =>
    set(({ layerConfigs }) => ({
      layerConfigs: layerConfigs ? [...layerConfigs] : null,
    })), // trigger rebuild of model

  activationStats: {},
  setActivationStats: (activationStats) => set({ activationStats }),

  activations: {},
  setActivations: (newActivations) => {
    set(({ activations }) => ({
      activations: { ...activations, ...newActivations },
    }))
  },

  evaluation: {},
  setEvaluation: (props) =>
    set((state) => ({
      evaluation: { ...state.evaluation, ...props },
    })),
  resetEvaluation: () => set({ evaluation: {} }),
})
