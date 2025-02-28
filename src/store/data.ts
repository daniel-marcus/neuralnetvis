import { StateCreator } from "zustand"
import type { Dataset, Sample } from "@/data"
import { createRef, RefObject } from "react"

export interface DataSlice {
  ds?: Dataset
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number
  sample?: Sample
  nextSample: (step?: number) => void
  resetSample: () => void

  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream: MediaStream | null
}

export const createDataSlice: StateCreator<DataSlice> = (set, get) => ({
  ds: undefined,
  totalSamples: () => get().ds?.train.totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: 0,
  sample: undefined,
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: (sampleIdx + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),

  videoRef: createRef<HTMLVideoElement>(),
  canvasRef: createRef<HTMLCanvasElement>(),
  stream: null,
})
