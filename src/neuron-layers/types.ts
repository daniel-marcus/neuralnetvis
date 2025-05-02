import * as tf from "@tensorflow/tfjs"
import * as THREE from "three"
import type { RefObject } from "react"
import type { MeshParams } from "@/neuron-layers/layout"
import { ColorObj } from "../utils/colors"

// Types for Layers

export type LayerType =
  | "InputLayer"
  | "Conv2D"
  | "Dense"
  | "Flatten"
  | "MaxPooling2D"
  | "Dropout"
  | "BatchNormalization"
  | "LayerNormalization"
  | "RandomRotation"
  | "DepthwiseConv2D" // TODO: keyof ...
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
  neurons: Neuron[]
  neuronsMap?: Map<Nid, Neuron>
  hasLabels?: boolean
  hasColorChannels: boolean
  groups: Group[]
  layerGroup: Group
}

// Types for Groups

export type MeshRef = RefObject<THREE.InstancedMesh | null>

export interface Group {
  index: number
  nids: Nid[]
  nidsStr: string // for deps optimization
  meshRef: MeshRef
  neurons: Neuron[]
}

export type NeuronGroupProps = LayerStateless & {
  group: Group
}

// Types for Neurons

export type Nid = string // layerIndex_{index3d.join(".")}

export type Index3D = [number, number, number] // height, width, depth

export type Neuron = {
  index: number
  index3d: Index3D
  nid: Nid
  layerIndex: number
  groupIndex: number
  indexInGroup: number
  meshRef: MeshRef
  visibleLayerIndex: number
  inputNids?: Nid[] // TODO: calculate on demand
  inputNeurons?: Neuron[] // for Conv2D: neurons in the receptive field
  label?: string
  layer: LayerStateless
  color: ColorObj
}

export type NeuronState = {
  rawInput?: number
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
  color: ColorObj
}

export type NeuronStateful = Neuron & NeuronState

export type HighlightProp = "weights" | "weightedInputs" | null
