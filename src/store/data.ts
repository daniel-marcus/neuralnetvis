import { StateCreator } from "zustand"
import type { Dataset, Sample } from "@/data"

export interface DataSlice {
  datasetKey?: string
  setDatasetKey: (key: string) => void
  ds?: Dataset
  setDs: (ds?: Dataset) => void
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number
  setSampleIdx: (arg: number | ((prev: number) => number)) => void
  next: (step?: number) => void
  sample?: Sample
  resetSample: () => void
}

export const createDataSlice: StateCreator<DataSlice> = (set, get) => ({
  datasetKey: undefined,
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) => set({ ds }),
  totalSamples: () => get().ds?.train.shapeX[0] ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: 0,
  setSampleIdx: (arg) =>
    set(({ sampleIdx }) => {
      return { sampleIdx: typeof arg === "function" ? arg(sampleIdx) : arg }
    }),
  next: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => {
      return {
        sampleIdx: (sampleIdx + step + totalSamples()) % totalSamples(),
      }
    }),
  sample: undefined,
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),
})
