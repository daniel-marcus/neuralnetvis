import { StateCreator } from "zustand"
import type { Dataset, Sample } from "@/data"

export interface DataSlice {
  datasetKey?: string
  ds?: Dataset
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number
  sample?: Sample
  nextSample: (step?: number) => void
  resetSample: () => void
}

export const createDataSlice: StateCreator<DataSlice> = (set, get) => ({
  datasetKey: undefined,
  ds: undefined,
  totalSamples: () => get().ds?.train.shapeX[0] ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: 0,
  sample: undefined,
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: (sampleIdx + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),
})
