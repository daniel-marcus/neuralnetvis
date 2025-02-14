import type { StateCreator } from "zustand"
import type { Vector3 } from "three"
import type { Neuron, Nid } from "@/neuron-layers"

export interface NeuronsSlice {
  allNeurons: Map<Nid, Neuron>
  hoveredNid?: Nid
  selectedNid?: Nid
  getSelected: () => Neuron | undefined
  getHovered: () => Neuron | undefined
  hasHoveredOrSelected: () => boolean

  toggleHovered: (n: Neuron | null) => void
  toggleSelected: (n: Neuron | null) => void

  // for experimental texture layer
  hoverOrigin?: Vector3
  setHovered: (n: Neuron | null, origin?: Vector3) => void
}

export const createNeuronsSlice: StateCreator<NeuronsSlice> = (set, get) => ({
  allNeurons: new Map(),
  hoveredNid: undefined,
  selectedNid: undefined,
  getSelected: () => {
    const { selectedNid } = get()
    return selectedNid ? get().allNeurons.get(selectedNid) : undefined
  },
  getHovered: () => {
    const { hoveredNid } = get()
    return hoveredNid ? get().allNeurons.get(hoveredNid) : undefined
  },
  hasHoveredOrSelected: () => Boolean(get().hoveredNid || get().selectedNid),
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
