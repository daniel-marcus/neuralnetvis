import type { Parsed } from "npyjs"
import type { Tensor, Rank } from "@tensorflow/tfjs"
import { preprocessFuncs } from "./preprocess"

export type DatasetKey = string

export interface DatasetMeta {
  key: DatasetKey // aka slug
  parentKey?: DatasetKey // for user-generated datasets
  task: "classification" | "regression"
  name: string
  description: string
  version: Date
  disabled?: boolean
  aboutUrl: string
  inputDims: number[]
  inputLabels?: string[]
  preprocessFunc?: keyof typeof preprocessFuncs
  outputLabels: string[] // length defines the number of output neurons
  storeBatchSize?: number // default: 100
  isUserGenerated?: boolean
  hasCam?: boolean
  mapProps?: DsMapProps
  loaded: "preview" | "full" // will be set by ds loader
}

export interface DatasetDef extends Omit<DatasetMeta, "loaded"> {
  loadPreview?: DatasetLoader
  loadFull?: DatasetLoader
}

export type PreprocessFuncDef = <T extends Tensor<Rank>>(
  X: T,
  inputDims: DatasetMeta["inputDims"]
) => T

export type PreprocessFunc = <T extends Tensor<Rank>>(X: T) => T

export type Dataset = DatasetMeta & {
  preprocess?: PreprocessFunc
  storeBatchSize: number
  train: StoreMeta
  test: StoreMeta
}

interface DsMapProps {
  center: [number, number]
  zoom: number
  baseLayer?: GeoJSON.FeatureCollection | GeoJSON.GeometryCollection
}

export interface StoreMeta {
  index: string // storeName: mnist_1_train
  totalSamples: number
  yMean?: number
}

export interface DbBatch {
  index: number
  xs: ParsedLike["data"]
  ys: ParsedLike["data"]
  xsRaw?: ParsedLike["data"]
  sampleNames?: string[]
}

export interface SampleRaw {
  X: number[]
  y?: number
  rawX?: number[]
  name?: string
}

export interface Sample extends SampleRaw {
  xTensor: Tensor<Rank>
}

type DatasetLoader = () => Promise<{
  xTrain: ParsedLike
  yTrain: ParsedLike
  xTest?: ParsedLike
  yTest?: ParsedLike
  xTrainRaw?: ParsedLike
  xTestRaw?: ParsedLike
  xTrainNames?: string[]
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

type ParsedSafe = Parsed & { data: SupportedTypedArray }

export function isSafe(parsed: Parsed): parsed is ParsedSafe {
  return !(
    parsed.data instanceof BigUint64Array ||
    parsed.data instanceof BigInt64Array ||
    parsed.data instanceof Float64Array
  )
}
