import type { StateCreator } from "zustand"
import { DataSlice, Subset } from "./data"

export type View = "model" | "evaluation" | "map"

export interface ViewSlice {
  isActive: boolean
  view: View
  setView: (view: View) => void
  subset: Subset
  setSubset: (subset: Subset) => void
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
  subset: "train",
  setSubset: (subset) =>
    set(({ totalSamples }) => {
      const newSampleIdx = Math.floor(Math.random() * totalSamples(subset))
      return { subset, sampleIdx: newSampleIdx }
    }),
})
