import type { StateCreator } from "zustand"
import type { Vector3 } from "three/webgpu"
import type { Neuron, NeuronLayer, Nid } from "@/neuron-layers"

export type NeuronView = "weights" | "weightedInputs" | "featureVis" | "topSamples"

export interface NeuronsSlice {
  allLayers: NeuronLayer[]
  setAllLayers: (layers: NeuronLayer[]) => void

  hoveredNid?: Nid
  selectedNid?: Nid
  setHoveredNid: (nid?: Nid) => void
  setSelectedNid: (nid?: Nid) => void

  toggleHovered: (nid?: Nid) => void
  toggleSelected: (nid?: Nid) => void

  neuronView: NeuronView // view in the neuron inspector
  setNeuronView: (neuronView: NeuronView) => void

  // for experimental texture layer
  hoverOrigin?: Vector3
  setHovered: (n: Neuron | null, origin?: Vector3) => void
}

export const createNeuronsSlice: StateCreator<NeuronsSlice> = (set) => ({
  allLayers: [],
  setAllLayers: (layers) => set({ allLayers: layers }),

  hoveredNid: undefined,
  selectedNid: undefined,
  setHoveredNid: (nid) => set({ hoveredNid: nid }),
  setSelectedNid: (nid) => set({ selectedNid: nid }),

  toggleSelected: (nid) =>
    set(({ selectedNid }) => ({
      selectedNid: nid === selectedNid ? undefined : nid,
    })),
  neuronView: "topSamples",
  setNeuronView: (neuronView) => set({ neuronView }),
  toggleHovered: (nid) =>
    set(({ hoveredNid }) => ({
      hoveredNid: nid === hoveredNid ? undefined : nid,
    })),

  setHovered: (hovered, hoverOrigin) => set({ hoveredNid: hovered?.nid, hoverOrigin }),
})
