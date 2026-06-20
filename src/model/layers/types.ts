import type {
  ActivationLayerArgs,
  DenseLayerArgs,
  DropoutLayerArgs,
  FlattenLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/core"
import type { ConvLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional"
import type { Pooling2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/pooling"
import type { InputLayerArgs } from "@tensorflow/tfjs-layers/dist/engine/input_layer"
import type {
  BatchNormalizationLayerArgs,
  LayerNormalizationLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/normalization"
import type { RandomRotationLayerArgs } from "./random-rotation"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Nid } from "@/neuron-layers/types"
import type { DepthwiseConv2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional_depthwise"
import type { ReLULayerArgs } from "@tensorflow/tfjs-layers/dist/layers/advanced_activations"
import type { ZeroPadding2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/padding"
import type { EmbeddingLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/embeddings"
import type { PositionEmbeddingLayerArgs } from "./position-embedding"
import type { LayerArgs } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { MultiHeadAttentionArgs } from "@tensorflow/tfjs-layers/dist/layers/nlp/multihead_attention"

// TODO: import from tfjs layers?
export type LayerConfigMap = {
  InputLayer: InputLayerArgs
  Dense: DenseLayerArgs
  Flatten: FlattenLayerArgs
  Conv2D: ConvLayerArgs
  MaxPooling2D: Pooling2DLayerArgs
  Dropout: DropoutLayerArgs
  BatchNormalization: BatchNormalizationLayerArgs
  LayerNormalization: LayerNormalizationLayerArgs
  RandomRotation: RandomRotationLayerArgs
  DepthwiseConv2D: DepthwiseConv2DLayerArgs
  ReLU: ReLULayerArgs
  ZeroPadding2D: ZeroPadding2DLayerArgs
  Activation: ActivationLayerArgs
  Embedding: EmbeddingLayerArgs
  PositionEmbedding: PositionEmbeddingLayerArgs
  Add: AddLayerArgs
  MultiHeadAttention: MultiHeadAttentionArgs
}

interface AddLayerArgs extends LayerArgs {
  otherLayerNames?: string[]
}

type InboundNode = [string, number, number, unknown] // [name, ...]

export type LayerConfig<T extends keyof LayerConfigMap> = {
  className: T
  config: LayerConfigMap[T]
  name?: string
  inboundNodes?: [InboundNode[]]
}

export type LayerConfigArray = LayerConfig<keyof LayerConfigMap>[]

interface BaseOption<T extends keyof LayerConfigMap> {
  name: keyof LayerConfigMap[T]
}

interface SliderOption<T extends keyof LayerConfigMap> extends BaseOption<T> {
  inputType: "slider"
  min: number
  max: number
  step?: number
  transformToSliderVal?: (v: number) => number
  transformFromSliderVal?: (v: number) => number
}

interface SelectOption<T extends keyof LayerConfigMap> extends BaseOption<T> {
  inputType: "select"
  getValue: (args: { layerConfig: LayerConfig<T> }) => string | undefined
  options:
    | string[]
    | ((args: { layerConfig: LayerConfig<T>; layerConfigs: LayerConfigArray }) => string[])
}

type ControllableOption<T extends keyof LayerConfigMap> = SliderOption<T> | SelectOption<T>

export type GetInputNidsFunc = (
  layer: Layer,
  neuronIdx: number,
  prevLayer: Layer,
  prevLayerIdx: number,
  depthwise?: boolean, // for DepthwiseConv2D and MaxPooling2D
) => Nid[]

export interface LayerDef<T extends keyof LayerConfigMap> {
  constructorFunc: (args: LayerConfigMap[T]) => Layer
  defaultConfig?: LayerConfigMap[T]
  options?: ControllableOption<T>[]
  getInputNids?: GetInputNidsFunc
  needsMultiDim?: boolean // TODO: better name?
  isInvisible?: boolean
  isUserAddable?: boolean
  // TODO: applicableCondition, orderRule, configTransform?,
}
