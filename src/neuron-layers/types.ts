import * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import type { RefObject } from "react"
import type { MeshParams } from "@/neuron-layers/layout"
import type { LayerConfigMap } from "@/model/layers/types"

// Types for Layers

export type LayerType = keyof LayerConfigMap // keyof typeof tf.layers?
export type LayerPos = "input" | "hidden" | "output"

export type MeshRef = RefObject<THREE.InstancedMesh | null>

export interface NeuronLayer {
  lid: string // for React keys: `${model.name}_${tfLayer.name}_${units}`
  index: number
  visibleIdx: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerType: LayerType
  layerPos: LayerPos
  tfLayer: tf.layers.Layer
  numNeurons: number
  numBiases: number // for Dense layers = numNeurons, for Conv2D = numFilters
  meshRefs: MeshRef[] // color layers: 1 per channel, otherwise 1 for layer
  meshParams: MeshParams
  prevLayer?: NeuronLayer
  hasLabels?: boolean
  hasColorChannels: boolean
  activations: Float32Array // used for activation colors, reused for performance = not reactive
  channelActivations: Float32Array[] // sliced view on activations for color channels
  activationsBuffer: THREE.StorageBufferAttribute
  storageNode: THREE.TSL.ShaderNodeObject<THREE.StorageBufferNode>
}

// Types for Neurons

export type Nid = string // layerIndex_neuronIndex
export type Index3D = [number, number, number] // height, width, depth

export type Neuron = {
  index: number
  nid: Nid
  index3d: Index3D
  channelIdx: number
  indexInChannel: number
  layer: NeuronLayer
  meshRef: MeshRef
  inputNids: Nid[]
  inputNeurons: Neuron[]
}

export type NeuronState = {
  rawInput?: number
  activation?: number
  weights?: number[]
  bias?: number
}

export type NeuronStateful = Neuron & NeuronState

export type HighlightProp = "weights" | "weightedInputs" | null
