import type { StateCreator } from "zustand"
import type { Vector3 } from "three"
import type { Neuron, Nid } from "@/neuron-layers"

export interface NeuronsSlice {
  hoveredNid?: Nid
  selectedNid?: Nid
  setHoveredNid: (nid?: Nid) => void
  setSelectedNid: (nid?: Nid) => void

  toggleHovered: (n: Neuron | null) => void
  toggleSelected: (n: Neuron | null) => void

  // for experimental texture layer
  hoverOrigin?: Vector3
  setHovered: (n: Neuron | null, origin?: Vector3) => void
}

export const createNeuronsSlice: StateCreator<NeuronsSlice> = (set) => ({
  allNeurons: new Map(),
  hoveredNid: undefined,
  selectedNid: undefined,
  setHoveredNid: (nid) => set({ hoveredNid: nid }),
  setSelectedNid: (nid) => set({ selectedNid: nid }),

  toggleSelected: (n) =>
    set(({ selectedNid }) => ({
      selectedNid: n?.nid === selectedNid ? undefined : n?.nid,
    })),
  toggleHovered: (n) =>
    set(({ hoveredNid }) => ({
      hoveredNid: n?.nid === hoveredNid ? undefined : n?.nid,
    })),

  setHovered: (hovered, hoverOrigin) =>
    set({ hoveredNid: hovered?.nid, hoverOrigin }),
})
