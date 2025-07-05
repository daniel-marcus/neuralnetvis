import { preprocessSample } from "@/data/sample"
import type { StateCreator } from "zustand"
import type { Dataset, Sample, SampleRaw, StoreMeta } from "@/data"
import type { ModelSlice } from "./model"
import type { VideoSlice } from "./video"
import type { SetterFunc } from "."

export type Subset = "train" | "test"

type SampleIdx = number | undefined

export interface DataSlice {
  shouldLoadFullDs?: boolean
  setLoadFullDs: (shouldLoadFullDs: boolean) => void

  ds?: Dataset
  setDs: (ds?: Dataset, setOnlyIfNecessary?: boolean) => void
  updateMeta: (storeName: Subset, meta: StoreMeta) => void
  totalSamples: (subset?: Subset) => number
  isRegression: () => boolean
  getAspectRatio: () => number

  sampleIdx: number | undefined
  setSampleIdx: (arg: SampleIdx | SetterFunc<SampleIdx>) => void

  sample?: Sample
  setSample: (sampleRaw?: SampleRaw, unsetSampleIdx?: boolean) => void
  nextSample: (step?: number) => void
  resetSample: () => void

  sampleViewerIdxs: number[]
  setSampleViewerIdxs: (idxs: number[]) => void
}

export const createDataSlice: StateCreator<
  DataSlice & ModelSlice & VideoSlice,
  [],
  [],
  DataSlice
> = (set, get) => ({
  shouldLoadFullDs: false,
  setLoadFullDs: (shouldLoadFullDs) => set({ shouldLoadFullDs }),

  ds: undefined,
  setDs: (ds, setOnlyIfNecessary) => {
    const oldDs = get().ds
    const sameKey = oldDs?.key === ds?.key
    if (setOnlyIfNecessary && oldDs?.loaded === ds?.loaded && sameKey) return
    const totalSamples = ds?.train.totalSamples ?? 0
    set(({ sampleIdx }) => ({
      ds,
      sample: undefined,
      sampleIdx: sampleIdx ?? Math.floor(Math.random() * totalSamples),
    }))
  },
  updateMeta: (storeName, meta) => {
    const ds = get().ds
    if (!ds) return
    const newDs = { ...ds, [storeName]: meta }
    set({
      ds: newDs,
      skipModelCreate: true,
    })
  },
  totalSamples: (subset = "train") => get().ds?.[subset].totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",
  getAspectRatio: () =>
    get().ds?.train.aspectRatio ?? get().ds?.camProps?.aspectRatio ?? 1,

  sampleIdx: undefined,
  setSampleIdx: (arg) =>
    set({
      sampleIdx: typeof arg === "function" ? arg(get().sampleIdx) : arg,
      stream: undefined, // stop stream when sample is clicked
    }),
  sample: undefined,
  setSample: (sampleRaw, unsetSampleIdx) =>
    set(({ ds, sampleIdx }) => ({
      sample: preprocessSample(sampleRaw, ds),
      sampleIdx: unsetSampleIdx ? undefined : sampleIdx,
    })),
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: ((sampleIdx ?? 0) + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),

  sampleViewerIdxs: [],
  setSampleViewerIdxs: (idxs) => set({ sampleViewerIdxs: idxs }),
})
