import type { StateCreator } from "zustand"
import type { DataSlice, Subset } from "./data"
import type { SetterFunc } from "."
import type { NeuronsSlice } from "./neurons"

export type View = "layers" | "graph" | "map" | "evaluation"

export interface ViewSlice {
  uid: string
  isActive: boolean
  shouldLoad: boolean // dataset & model are (being) loaded
  isHovered: boolean
  setIsHovered: (isHovered: boolean) => void
  view: View
  setView: (view: View) => void
  subset: Subset
  setSubset: (subset: Subset) => void
  focussedLayerIdx: number | undefined
  setFocussedLayerIdx: (arg: number | undefined | SetterFunc<number | undefined>) => void
  hoveredLayerIdx: number | undefined
  setHoveredLayerIdx: (arg: number | undefined | SetterFunc<number | undefined>) => void
  isScrolling: boolean
  setIsScrolling: (isScrolling: boolean) => void
  showSampleViewer: boolean // can be toggled programmatically, e.g. in lessons
  setShowSampleViewer: (showSampleViewer: boolean) => void
}

export const createViewSlice: StateCreator<
  ViewSlice & DataSlice & NeuronsSlice,
  [],
  [],
  ViewSlice
> = (set) => ({
  uid: "unset",
  isActive: false,
  shouldLoad: false,
  isHovered: false,
  setIsHovered: (isHovered) => set({ isHovered }),
  view: "layers",
  setView: (view) =>
    set(({ sampleIdx, ds }) => {
      const hasTestData = !!ds?.test.totalSamples
      return {
        view,
        subset: view === "evaluation" && hasTestData ? "test" : "train",
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
  focussedLayerIdx: undefined,
  setFocussedLayerIdx: (arg) =>
    set(({ focussedLayerIdx, selectedNid }) => {
      const newIdx = typeof arg === "function" ? arg(focussedLayerIdx) : arg
      // keep the selected neuron when leaving the focus (to show its connections), but not in other layers
      const keepSelected = newIdx === undefined || !!selectedNid?.startsWith(`${newIdx}_`)
      return {
        focussedLayerIdx: newIdx,
        hoveredNid: undefined,
        selectedNid: keepSelected ? selectedNid : undefined,
      }
    }),
  hoveredLayerIdx: undefined,
  setHoveredLayerIdx: (arg) =>
    set(({ hoveredLayerIdx }) => ({
      hoveredLayerIdx: typeof arg === "function" ? arg(hoveredLayerIdx) : arg,
    })),
  isScrolling: false,
  setIsScrolling: (isScrolling) => set({ isScrolling }),
  showSampleViewer: true,
  setShowSampleViewer: (showSampleViewer) => set({ showSampleViewer }),
})
