import { Neuron, NeuronDef, Nid } from "@/neuron-layers/neuron"
import { MeshParams } from "@/neuron-layers/layer-layout"
import * as tf from "@tensorflow/tfjs"

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
