import { StateCreator } from "zustand"
import type { TrainingConfig } from "@/model"
import type { History } from "@tensorflow/tfjs"
import type { Metric, TrainingLog } from "@/components/ui-elements/logs-plot"
import { StatusSlice } from "./status"

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
  //
  logs: TrainingLog[]
  addLogs: (newLogs: TrainingLog[]) => void
  logsMetric: Metric
  setLogsMetric: (metric: Metric) => void
}
// SC<TrainingSlice> /
export const createTrainingSlice: StateCreator<
  TrainingSlice & StatusSlice,
  [],
  [],
  TrainingSlice
> = (set) => ({
  trainConfig: {
    batchSize: 128,
    epochs: 10,
    validationSplit: 0.1,
    silent: true,
    lazyLoading: true,
  },
  setTrainConfig: (newConfig) =>
    set(({ trainConfig }) => ({
      trainConfig: { ...trainConfig, ...newConfig },
    })),

  isTraining: false,
  setIsTraining: (isTraining) => set({ isTraining }),
  toggleTraining: () =>
    set(({ isTraining, status }) => {
      if (isTraining)
        return { isTraining: false, status: { ...status, percent: null } }
      // trigger spinner with training start
      else return { isTraining: true, status: { ...status, percent: -1 } }
    }),
  trainingPromise: null,

  batchCount: 0,
  setBatchCount: (arg) =>
    set(({ batchCount }) => ({
      batchCount: typeof arg === "function" ? arg(batchCount) : arg,
    })),
  epochCount: 0,
  setEpochCount: (epochCount) => set({ epochCount }),
  resetTrainCounts: () => {
    set({ isTraining: false, batchCount: 0, epochCount: 0, logs: [] })
  },

  logs: [] as TrainingLog[],
  addLogs: (newLogs) => set(({ logs }) => ({ logs: [...logs, ...newLogs] })),
  logsMetric: "loss",
  setLogsMetric: (logsMetric) => set({ logsMetric }),
})
