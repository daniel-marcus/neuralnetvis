import type { StateCreator } from "zustand"
import type { Vector3 } from "three"
import type { Neuron, Nid } from "@/neuron-layers"

export interface NeuronsSlice {
  hoveredNid?: Nid
  selectedNid?: Nid
  setHoveredNid: (nid?: Nid) => void
  setSelectedNid: (nid?: Nid) => void

  toggleHovered: (nid?: Nid) => void
  toggleSelected: (nid?: Nid) => void

  // for experimental texture layer
  hoverOrigin?: Vector3
  setHovered: (n: Neuron | null, origin?: Vector3) => void
}

export const createNeuronsSlice: StateCreator<NeuronsSlice> = (set) => ({
  hoveredNid: undefined,
  selectedNid: undefined,
  setHoveredNid: (nid) => set({ hoveredNid: nid }),
  setSelectedNid: (nid) => set({ selectedNid: nid }),

  toggleSelected: (nid) =>
    set(({ selectedNid }) => ({
      selectedNid: nid === selectedNid ? undefined : nid,
    })),
  toggleHovered: (nid) =>
    set(({ hoveredNid }) => ({
      hoveredNid: nid === hoveredNid ? undefined : nid,
    })),

  setHovered: (hovered, hoverOrigin) =>
    set({ hoveredNid: hovered?.nid, hoverOrigin }),
})
