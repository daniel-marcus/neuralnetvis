import type { StateCreator } from "zustand"
import { DataSlice, Subset } from "./data"
import { SetterFunc } from "."

export type View = "model" | "evaluation" | "map" | "graph" // model -> layers

export interface ViewSlice {
  isActive: boolean
  view: View
  setView: (view: View) => void
  subset: Subset
  setSubset: (subset: Subset) => void
  sampleViewerIdxs: number[]
  setSampleViewerIdxs: (idxs: number[]) => void
  focussedLayerIdx: number | undefined
  setFocussedLayerIdx: (
    arg: number | undefined | SetterFunc<number | undefined>
  ) => void
  hoveredLayerIdx: number | undefined
  setHoveredLayerIdx: (
    arg: number | undefined | SetterFunc<number | undefined>
  ) => void
}

export const createViewSlice: StateCreator<
  ViewSlice & DataSlice,
  [],
  [],
  ViewSlice
> = (set) => ({
  isActive: false,
  view: "model",
  setView: (view) =>
    set(({ sampleIdx, ds, subset }) => {
      const hasTestData = !!ds?.test.totalSamples
      return {
        view,
        subset: view === "evaluation" && hasTestData ? "test" : subset,
        sampleIdx: view === "evaluation" ? undefined : sampleIdx,
      }
    }),
  subset: "train",
  setSubset: (subset) =>
    set(({ totalSamples, sampleIdx }) => {
      const newSampleIdx =
        typeof sampleIdx !== "undefined" && sampleIdx > totalSamples(subset) - 1
          ? Math.floor(Math.random() * totalSamples(subset))
          : sampleIdx
      return { subset, sampleIdx: newSampleIdx }
    }),
  sampleViewerIdxs: [],
  setSampleViewerIdxs: (idxs) => set({ sampleViewerIdxs: idxs }),
  focussedLayerIdx: undefined,
  setFocussedLayerIdx: (arg) =>
    set(({ focussedLayerIdx }) => ({
      focussedLayerIdx: typeof arg === "function" ? arg(focussedLayerIdx) : arg,
    })),
  hoveredLayerIdx: undefined,
  setHoveredLayerIdx: (arg) =>
    set(({ hoveredLayerIdx }) => ({
      hoveredLayerIdx: typeof arg === "function" ? arg(hoveredLayerIdx) : arg,
    })),
})
