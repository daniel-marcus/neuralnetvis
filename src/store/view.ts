import type { StateCreator } from "zustand"
import { DataSlice } from "./data"

type View = "model" | "plot" | "map"

export interface ViewSlice {
  isActive: boolean
  view: View
  setView: (view: View) => void
  viewSubset: "train" | "test"
  setViewSubset: (subset: "train" | "test") => void
}

export const createViewSlice: StateCreator<
  ViewSlice & DataSlice,
  [],
  [],
  ViewSlice
> = (set) => ({
  isActive: false,
  view: "model",
  setView: (view) => set({ view }),
  viewSubset: "train",
  setViewSubset: (viewSubset) =>
    set(({ totalSamples }) => {
      if (viewSubset === "test" && totalSamples("test") === 0) return {}
      const newSampleIdx = Math.floor(Math.random() * totalSamples(viewSubset))
      return { viewSubset, sampleIdx: newSampleIdx }
    }),
})
