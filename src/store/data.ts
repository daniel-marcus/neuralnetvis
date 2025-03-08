import { StateCreator } from "zustand"
import type { Dataset, Sample, StoreMeta } from "@/data"
import { ModelSlice } from "./model"

export interface DataSlice {
  ds?: Dataset
  setDs: (ds?: Dataset) => void
  updateMeta: (storeName: "train" | "test", meta: StoreMeta) => void
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number
  setSampleIdx: (idx: number) => void
  sample?: Sample
  setSample: (sample?: Sample) => void
  nextSample: (step?: number) => void
  resetSample: () => void
}

export const createDataSlice: StateCreator<
  DataSlice & ModelSlice,
  [],
  [],
  DataSlice
> = (set, get) => ({
  ds: undefined,
  setDs: (ds) => set({ ds }),
  updateMeta: (storeName, meta) => {
    const ds = get().ds
    if (!ds) return
    const newDs = { ...ds, [storeName]: meta }
    set({ ds: newDs, skipModelCreate: true })
  },
  totalSamples: () => get().ds?.train.totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: 0,
  setSampleIdx: (sampleIdx) => set({ sampleIdx }),
  sample: undefined, // TODO: no global sample
  setSample: (sample) => set({ sample }),
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: (sampleIdx + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),
})
