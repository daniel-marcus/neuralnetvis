import {
  ActivationLayerArgs,
  DenseLayerArgs,
  DropoutLayerArgs,
  FlattenLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/core"
import { ConvLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional"
import { Pooling2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/pooling"
import { InputLayerArgs } from "@tensorflow/tfjs-layers/dist/engine/input_layer"
import {
  BatchNormalizationLayerArgs,
  LayerNormalizationLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/normalization"
import { RandomRotationLayerArgs } from "./random-rotation"
import { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import { Nid } from "@/neuron-layers"
import { DepthwiseConv2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional_depthwise"
import { ReLULayerArgs } from "@tensorflow/tfjs-layers/dist/layers/advanced_activations"
import { ZeroPadding2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/padding"

// TODO: import from tfjs layers
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
}

export type LayerConfig<T extends keyof LayerConfigMap> = {
  className: T
  config: LayerConfigMap[T]
}

export type LayerConfigArray = LayerConfig<keyof LayerConfigMap>[]

interface ControlableOption<T extends keyof LayerConfigMap> {
  name: keyof LayerConfigMap[T]
  inputType: "slider" // | "select" | "checkbox"
  min: number // TODO bind to inputType / optional
  max: number
  step?: number
  transformToSliderVal?: (v: number) => number
  transformFromSliderVal?: (v: number) => number
}

type GetInputNeuronsFunc = (
  layer: Layer,
  prev: Layer,
  prevIdx: number
) => Nid[][]

export interface LayerDef<T extends keyof LayerConfigMap> {
  constructorFunc: (args: LayerConfigMap[T]) => Layer
  defaultConfig: LayerConfigMap[T]
  options?: ControlableOption<T>[]
  getInputNids?: GetInputNeuronsFunc
  needsMultiDim?: boolean // TODO: better name?
  isInvisible?: boolean
  isUserAddable?: boolean
  // TODO: applicableCondition, orderRule, configTransform?,
}
