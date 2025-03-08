import { StateCreator } from "zustand"
import type { Dataset, Sample } from "@/data"
import { createRef, RefObject } from "react"

interface DsSlice {
  ds?: Dataset
  setDs: (ds?: Dataset) => void
  totalSamples: () => number
  isRegression: () => boolean

  sampleIdx: number
  sample?: Sample
  setSample: (sample?: Sample) => void
  nextSample: (step?: number) => void
  resetSample: () => void
}

interface VideoSlice {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream: MediaStream | null
  setStream: (stream: MediaStream | null) => void
  isRecording: boolean
  toggleRecording: () => void
}

export type DataSlice = DsSlice & VideoSlice

export const createDataSlice: StateCreator<DataSlice> = (set, get) => ({
  ds: undefined,
  setDs: (ds) => set({ ds }),
  totalSamples: () => get().ds?.train.totalSamples ?? 0,
  isRegression: () => get().ds?.task === "regression",

  sampleIdx: 0,
  sample: undefined, // TODO: no global sample
  setSample: (sample) => set({ sample }),
  nextSample: (step = 1) =>
    set(({ sampleIdx, totalSamples }) => ({
      sampleIdx: (sampleIdx + step + totalSamples()) % totalSamples(),
    })),
  resetSample: () => set(() => ({ sampleIdx: 0, sample: undefined })),

  videoRef: createRef<HTMLVideoElement>(),
  canvasRef: createRef<HTMLCanvasElement>(),
  stream: null,
  setStream: (stream) => set({ stream }),
  isRecording: false,
  toggleRecording: () =>
    set(({ isRecording }) => ({ isRecording: !isRecording })),
})
