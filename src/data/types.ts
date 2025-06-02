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
  camProps?: DsCamProps
  mapProps?: DsMapProps
  decodeInput?: boolean // TODO: specify tokenizer
  loaded: "preview" | "full" // will be set by ds loader
  modelKey?: string // default model to load for this dataset
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
  baseLayer?: GeoJSON.FeatureCollection | GeoJSON.GeometryCollection | string // URL
}

interface DsCamProps {
  aspectRatio?: number
  processor?: "handPose"
}

export interface StoreMeta {
  index: string // storeName: mnist_1_train
  totalSamples: number
  aspectRatio?: number // for video
}

export interface DbBatch {
  index: number
  xs: ParsedLike["data"]
  ys: ParsedLike["data"]
  xsRaw?: ParsedLike["data"]
  sampleNames?: string[]
}

export interface SampleRaw {
  index: number
  X: number[]
  y?: number
  rawX?: number[]
  name?: string
}

export interface Sample extends SampleRaw {
  xTensor: Tensor<Rank> // preprocessed
}

type DatasetLoader = () => Promise<{
  xTrain: ParsedLike
  yTrain: ParsedLike
  xTest?: ParsedLike
  yTest?: ParsedLike
  xTrainRaw?: ParsedLike
  xTestRaw?: ParsedLike
  xTrainNames?: string[]
  xTestNames?: string[]
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
