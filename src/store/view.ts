import type { StateCreator } from "zustand"
import type { DataSlice, Subset } from "./data"
import type { SetterFunc } from "."
import type { NeuronsSlice } from "./neurons"

export type View = "layers" | "graph" | "map" | "evaluation"

export interface ViewSlice {
  uid: string
  isActive: boolean
  isHovered: boolean
  setIsHovered: (isHovered: boolean) => void
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
  isScrolling: boolean
  setIsScrolling: (isScrolling: boolean) => void
}

export const createViewSlice: StateCreator<
  ViewSlice & DataSlice & NeuronsSlice,
  [],
  [],
  ViewSlice
> = (set) => ({
  uid: "unset",
  isActive: false,
  isHovered: false,
  setIsHovered: (isHovered) => set({ isHovered }),
  view: "layers",
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
      hoveredNid: undefined,
      selectedNid: undefined,
    })),
  hoveredLayerIdx: undefined,
  setHoveredLayerIdx: (arg) =>
    set(({ hoveredLayerIdx }) => ({
      hoveredLayerIdx: typeof arg === "function" ? arg(hoveredLayerIdx) : arg,
    })),
  isScrolling: false,
  setIsScrolling: (isScrolling) => set({ isScrolling }),
})
