import * as tf from "@tensorflow/tfjs"
import { RefObject } from "react"
import { MeshParams } from "@/neuron-layers/layout"
import { InstancedMeshRef } from "@/scene/neuron-group"

// Types for Layers

export type LayerType =
  | "InputLayer"
  | "Conv2D"
  | "Dense"
  | "Flatten"
  | "MaxPooling2D"
export type LayerPos = "input" | "hidden" | "output"

export interface LayerStateless {
  index: number
  visibleIdx: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerType: LayerType
  layerPos: LayerPos
  tfLayer: tf.layers.Layer
  numBiases: number // for Dense layers = numNeurons, for Conv2D = numFilters
  meshParams: MeshParams
  prevLayer?: LayerStateless
  prevVisibleLayer?: LayerStateless
  neurons: NeuronDef[]
  neuronsMap?: Map<Nid, NeuronDef>
  hasLabels?: boolean
  hasColorChannels: boolean
  groups: GroupDef[]
}

export interface LayerStateful extends LayerStateless {
  neurons: Neuron[]
  maxAbsWeight?: number
}

export interface GroupDef {
  nids: Nid[]
  nidsStr: string // for deps optimization
}

// Types for Neurons

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
  ref: RefObject<NeuronRefType>
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

export type Neuron = NeuronDef & NeuronState
