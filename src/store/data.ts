import { StateCreator } from "zustand"
import type { Dataset, Sample, SampleRaw, StoreMeta } from "@/data"
import type { ModelSlice } from "./model"
import { preprocessSample } from "@/data/sample"

export type Subset = "train" | "test"

export interface DataSlice {
  shouldLoadFullDs?: boolean
  setLoadFullDs: (shouldLoadFullDs: boolean) => void

  ds?: Dataset
  setDs: (ds?: Dataset) => void
  updateMeta: (storeName: Subset, meta: StoreMeta) => void
  totalSamples: (subset?: Subset) => number
  isRegression: () => boolean
  getAspectRatio: () => number

  sampleIdx: number | undefined
  setSampleIdx: (idx: number | undefined) => void
  sample?: Sample
  setSample: (sampleRaw?: SampleRaw) => void
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
      sample: undefined,
      sampleIdx:
        sampleIdx ?? Math.floor(Math.random() * (ds?.train.totalSamples ?? 0)),
    })),
  updateMeta: (storeName, meta) => {
    const ds = get().ds
    if (!ds) return
    const newDs = { ...ds, [storeName]: meta }
    set({ ds: newDs, skipModelCreate: true })
  },
  totalSamples: (subset = "train") => get().ds?.[subset].totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",
  getAspectRatio: () =>
    get().ds?.train.aspectRatio ?? get().ds?.camProps?.aspectRatio ?? 1,

  sampleIdx: undefined,
  setSampleIdx: (sampleIdx) => set({ sampleIdx }),
  sample: undefined,
  setSample: (sampleRaw) =>
    set(({ ds }) => ({ sample: preprocessSample(sampleRaw, ds) })),
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: ((sampleIdx ?? 0) + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),
})
