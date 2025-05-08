import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"

// state

export interface LayerActivations {
  activations: Float32Array // [neuronIdx]
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
  normPredicted: number // divided by max value of actual y (for regression only)
}

export interface Evaluation {
  predictions?: Prediction[]
  loss?: number
  accuracy?: number
  rSquared?: number
}
