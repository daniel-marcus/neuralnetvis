import * as tf from "@tensorflow/tfjs"
import * as THREE from "three"
import type { RefObject } from "react"
import type { MeshParams } from "@/neuron-layers/layout"
import type { LayerConfigMap } from "@/model/layers/types"

// Types for Layers

export type LayerType = keyof LayerConfigMap // keyof typeof tf.layers?
export type LayerPos = "input" | "hidden" | "output"

export interface NeuronLayer {
  lid: string // for React keys: `${tfLayer.name}_${units}`
  index: number
  visibleIdx: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerType: LayerType
  layerPos: LayerPos
  tfLayer: tf.layers.Layer
  numBiases: number // for Dense layers = numNeurons, for Conv2D = numFilters
  meshParams: MeshParams
  prevLayer?: NeuronLayer
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

export type NeuronGroupProps = NeuronLayer & {
  group: Group
}

// Types for Neurons

export type Nid = string // layerIndex_{index3d.join(".")}

export type Index3D = [number, number, number] // height, width, depth

export type Neuron = {
  index: number
  index3d: Index3D
  nid: Nid
  groupIndex: number
  indexInGroup: number
  layer: NeuronLayer
  meshRef: MeshRef
  label?: string
  inputNids?: Nid[]
  inputNeurons?: Neuron[]
}

export type NeuronState = {
  rawInput?: number
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
}

export type NeuronStateful = Neuron & NeuronState

export type HighlightProp = "weights" | "weightedInputs" | null
