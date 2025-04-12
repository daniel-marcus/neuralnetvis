import {
  DenseLayerArgs,
  DropoutLayerArgs,
  FlattenLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/core"
import { ConvLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional"
import { Pooling2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/pooling"
import { InputLayerArgs } from "@tensorflow/tfjs-layers/dist/engine/input_layer"
import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"
import { BatchNormalizationLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/normalization"
import { RandomRotationLayerArgs } from "./custom-layers"
import { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

// Layers

export type LayerConfigMap = {
  InputLayer: InputLayerArgs
  Dense: DenseLayerArgs
  Flatten: FlattenLayerArgs
  Conv2D: ConvLayerArgs
  MaxPooling2D: Pooling2DLayerArgs
  Dropout: DropoutLayerArgs
  BatchNormalization: BatchNormalizationLayerArgs
  RandomRotation: RandomRotationLayerArgs
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

export interface LayerDef<T extends keyof LayerConfigMap> {
  constructorFunc: (args: LayerConfigMap[T]) => Layer
  defaultConfig: LayerConfigMap[T]
  options?: ControlableOption<T>[]
  // TODO: constructor, applicableCondition, orderRule, configTransform?
}

// state

export interface LayerActivations {
  activations: number[] // [neuronIdx]
  normalizedActivations: number[]
}

export interface WeightsBiases {
  weights?: number[][] // weights per neuron / filter
  biases?: number[]
  maxAbsWeight?: number
}

// training

export interface TrainingConfig {
  batchSize: number
  epochs: number
  validationSplit: number
  learningRate: number
  silent: boolean
  lazyLoading: boolean
}

// callbacks

type FitParams = {
  // passed to callbacks in model.fit()
  epochs: number
  samples: number
  batchSize: number
  initialEpoch: number
  steps: null
}
type FitDatasetParams = {
  // passed to callbacks in model.fitDataset()
  epochs: number
  samples: null
  batchSize: null
  initialEpoch: null
  steps: number // batchesPerEpoch has to be set
}

export type TypedParams = Params & (FitParams | FitDatasetParams)

// evaluation

export interface Prediction {
  actual: number
  predicted: number
  normPredicted: number // divided by max value of actual y
}

export interface Evaluation {
  predictions?: Prediction[]
  loss?: number
  accuracy?: number
  rSquared?: number
}
