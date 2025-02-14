import type { StateCreator } from "zustand"
import type { TrainingConfig } from "@/model"
import type { History } from "@tensorflow/tfjs"

export interface TrainingSlice {
  trainConfig: TrainingConfig
  setTrainConfig: (newConfig: Partial<TrainingConfig>) => void
  isTraining: boolean
  setIsTraining: (val: boolean) => void
  toggleTraining: () => void
  trainingPromise: Promise<History | void> | null
  batchCount: number
  setBatchCount: (arg: number | ((prev: number) => number)) => void
  epochCount: number
  setEpochCount: (val: number) => void
  resetTrainCounts: () => void
}

export const createTrainingSlice: StateCreator<TrainingSlice> = (set) => ({
  trainConfig: {
    batchSize: 256,
    epochs: 10,
    validationSplit: 0.0,
    silent: true,
    lazyLoading: true,
  },
  setTrainConfig: (newConfig) =>
    set(({ trainConfig }) => ({
      trainConfig: { ...trainConfig, ...newConfig },
    })),

  isTraining: false,
  setIsTraining: (isTraining) => set({ isTraining }),
  toggleTraining: () => set((s) => ({ isTraining: !s.isTraining })),
  trainingPromise: null,

  batchCount: 0,
  setBatchCount: (arg) =>
    set(({ batchCount }) => ({
      batchCount: typeof arg === "function" ? arg(batchCount) : arg,
    })),
  epochCount: 0,
  setEpochCount: (epochCount) => set({ epochCount }),
  resetTrainCounts: () => {
    // useLogStore.getState().resetLogs() // TODO
    set({ isTraining: false, batchCount: 0, epochCount: 0 })
  },
})
