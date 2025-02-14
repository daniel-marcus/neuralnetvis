import {
  DenseLayerArgs,
  DropoutLayerArgs,
  FlattenLayerArgs,
} from "@tensorflow/tfjs-layers/dist/layers/core"
import { ConvLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/convolutional"
import { Pooling2DLayerArgs } from "@tensorflow/tfjs-layers/dist/layers/pooling"
import { InputLayerArgs } from "@tensorflow/tfjs-layers/dist/engine/input_layer"
import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"

// Layers

export type LayerConfigMap = {
  Dense: DenseLayerArgs
  Conv2D: ConvLayerArgs
  MaxPooling2D: Pooling2DLayerArgs
  Flatten: FlattenLayerArgs
  Dropout: DropoutLayerArgs
  InputLayer: InputLayerArgs
}

export type LayerConfig<T extends keyof LayerConfigMap> = {
  className: T
  config: LayerConfigMap[T]
  isInvisible?: boolean
}

export type LayerConfigArray = LayerConfig<keyof LayerConfigMap>[]

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
