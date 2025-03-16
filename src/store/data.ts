import { StateCreator } from "zustand"
import type { Dataset, Sample, StoreMeta } from "@/data"
import { ModelSlice } from "./model"

export interface DataSlice {
  shouldLoadFullDs?: boolean
  setLoadFullDs: (shouldLoadFullDs: boolean) => void

  ds?: Dataset
  setDs: (ds?: Dataset) => void
  updateMeta: (storeName: "train" | "test", meta: StoreMeta) => void
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number | undefined
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
  shouldLoadFullDs: false,
  setLoadFullDs: (shouldLoadFullDs) => set({ shouldLoadFullDs }),

  ds: undefined,
  setDs: (ds) =>
    set(({ sampleIdx }) => ({
      ds,
      sampleIdx:
        sampleIdx ?? Math.floor(Math.random() * (ds?.train.totalSamples ?? 0)),
    })),
  updateMeta: (storeName, meta) => {
    const ds = get().ds
    if (!ds) return
    const newDs = { ...ds, [storeName]: meta }
    set({ ds: newDs, skipModelCreate: true })
  },
  totalSamples: () => get().ds?.train.totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: undefined,
  setSampleIdx: (sampleIdx) => set({ sampleIdx }),
  sample: undefined, // TODO: no global sample
  setSample: (sample) => set({ sample }),
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: ((sampleIdx ?? 0) + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),
})
