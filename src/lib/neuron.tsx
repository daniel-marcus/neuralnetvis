import React from "react"

import { LayerStateful, LayerStateless } from "@/three/layer"
import { InstancedMeshRef } from "@/three/neuron-group"

export type Nid = string // layerIndex_{index3d.join(".")}
export type NeuronRefType = {
  meshRef: InstancedMeshRef
  indexInGroup: number
} | null

export type Index3D = [number, number, number] // height, width, depth

export type NeuronDef = {
  index: number
  index3d: Index3D
  nid: Nid
  layerIndex: number
  groupIndex: number
  visibleLayerIndex: number
  ref: React.RefObject<NeuronRefType>
  inputNids?: Nid[]
  inputNeurons?: NeuronDef[] // for Conv2D: neurons in the receptive field
  label?: string
  layer: LayerStateless
}

export type NeuronState = {
  rawInput?: number
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
  highlightValue?: number // [-1, 1]
}

type NeuronContext = {
  allLayers?: LayerStateful[]
}

export type Neuron = NeuronDef & NeuronState & NeuronContext
