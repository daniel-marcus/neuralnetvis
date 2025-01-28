import React from "react"

import type { NodeInput } from "@/lib/datasets"
import { LayerStateful, LayerStateless } from "./layer"
import { InstancedMeshRef } from "./neuron-group"

// refactoring in progress, kept only for type definitions, all logic is handled in NeuronGroupInstanced now

export type Nid = string // layerIndex_{index3d.join(".")}
export type NeuronRefType = {
  meshRef: InstancedMeshRef
  indexInGroup: number
} | null // Object3D | null

export type Index3D = [number, number, number] // height, width, depth

export type NeuronDef = {
  index: number
  index3d: Index3D
  nid: Nid
  layerIndex: number
  visibleLayerIndex: number
  ref: React.RefObject<NeuronRefType>
  hasColorChannels?: boolean
  inputNids?: Nid[]
  inputNeurons?: Neuron[] // for Conv2D: neurons in the receptive field
  label?: string
  layer: LayerStateless
}

export type NeuronState = {
  rawInput?: NodeInput // maybe element of ... ?
  activation?: number
  normalizedActivation?: number
  inputs?: number[]
  weights?: number[]
  bias?: number
  highlightValue?: number // [-1, 1] TODO: refactor
}

type NeuronContext = {
  allLayers?: LayerStateful[]
}

export type Neuron = NeuronDef & NeuronState & NeuronContext
