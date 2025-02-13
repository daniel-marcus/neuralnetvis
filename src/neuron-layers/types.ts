import * as tf from "@tensorflow/tfjs"
import type { InstancedMesh } from "three"
import type { RefObject } from "react"
import type { MeshParams } from "@/neuron-layers/layout"

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

// Types for Groups

export type InstancedMeshRef = RefObject<InstancedMesh | null>

export interface GroupDef {
  index: number
  nids: Nid[]
  nidsStr: string // for deps optimization
  meshRef: InstancedMeshRef
}

export type NeuronGroupProps = LayerStateful & {
  group: GroupDef
  groupedNeurons: Neuron[]
}

// Types for Neurons

export type Nid = string // layerIndex_{index3d.join(".")}

export type Index3D = [number, number, number] // height, width, depth

export type NeuronDef = {
  index: number
  index3d: Index3D
  nid: Nid
  layerIndex: number
  groupIndex: number
  indexInGroup: number
  meshRef: InstancedMeshRef
  visibleLayerIndex: number
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
