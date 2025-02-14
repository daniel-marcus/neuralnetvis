import type { StateCreator } from "zustand"
import type { Vector3 } from "three"
import type { Neuron, Nid } from "@/neuron-layers"

export interface SelectedSlice {
  hovered: Neuron | null
  selected: Neuron | null
  getHoveredNid: () => Nid | null
  getSelectedNid: () => Nid | null
  toggleHovered: (n: Neuron | null) => void
  toggleSelected: (n: Neuron | null) => void
  setSelected: (n: Neuron | null) => void
  hoverOrigin?: Vector3
  setHovered: (n: Neuron | null, origin?: Vector3) => void
  hasHoveredOrSelected: () => boolean
  // TODO: make all neuron accessible by nid?
}

export const createSelectedSlice: StateCreator<SelectedSlice> = (set, get) => ({
  hovered: null,
  selected: null,
  getHoveredNid: () => get().hovered?.nid ?? null,
  getSelectedNid: () => get().selected?.nid ?? null,
  toggleSelected: (n) =>
    set(({ selected }) => ({
      selected: selected && n?.nid === selected.nid ? null : n,
    })),
  setSelected: (selected) => set({ selected }),
  setHovered: (hovered, hoverOrigin) => set({ hovered, hoverOrigin }),
  toggleHovered: (n) =>
    set(({ hovered }) => ({
      hovered: hovered && n?.nid === hovered.nid ? null : n,
    })),
  hasHoveredOrSelected: () => Boolean(get().hovered || get().selected),
})
