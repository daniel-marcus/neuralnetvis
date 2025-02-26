import type { Parsed } from "npyjs"
import type { Tensor, Rank } from "@tensorflow/tfjs"

export type DatasetKey = string

export interface DatasetDef {
  key: DatasetKey
  task: "classification" | "regression"
  name: string
  description: string
  version: Date
  disabled?: boolean
  aboutUrl: string
  input?: {
    labels?: string[]
    preprocess?: <T extends Tensor<Rank>>(X: T) => T
  }
  output: {
    labels: string[] // length defines the number of output neurons
  }
  loadData: DatasetLoader
  storeBatchSize?: number // default: 100
  isUserGenerated?: boolean
  hasCam?: boolean
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
  train: StoreMeta
  test: StoreMeta
}

export interface StoreMeta {
  index: string // storeName: mnist_1_train
  version: Date
  shapeX: number[]
  shapeY: number[]
  storeBatchSize: number
  valsPerSample: number
}

export interface DbBatch {
  index: number
  xs: ParsedLike["data"]
  ys: ParsedLike["data"]
  xsRaw?: ParsedLike["data"]
}

export type Sample = {
  X: number[]
  y?: number
  rawX?: number[]
}

type DatasetLoader = () => Promise<{
  xTrain: ParsedLike
  yTrain: ParsedLike
  xTest: ParsedLike
  yTest: ParsedLike
  xTrainRaw?: ParsedLike
  xTestRaw?: ParsedLike
}>

export interface ParsedLike {
  data: SupportedTypedArray
  shape: number[]
}

type SupportedTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type ParsedSafe = Parsed & { data: SupportedTypedArray }

export function isSafe(parsed: Parsed): parsed is ParsedSafe {
  return !(
    parsed.data instanceof BigUint64Array ||
    parsed.data instanceof BigInt64Array
  )
}
