import type { Parsed } from "npyjs"
import type { Tensor, Rank } from "@tensorflow/tfjs"
import type { PreprocessFuncName } from "./preprocess"
import type { ModelDef } from "@/model/models"
import { TokenizerName, TokenizerType } from "./tokenizer"

export type DatasetKey = string

// DatasetMeta needs to be serializable to JSON since it gets stored in IndexedDB, so no functions here
export interface DatasetMeta {
  key: DatasetKey // aka slug
  parentKey?: DatasetKey // for user-generated datasets
  task: "classification" | "regression"
  name: string
  description: string
  version: Date
  disabled?: boolean
  isFeatured?: boolean
  aboutUrl: string
  inputDims: number[]
  inputLabels?: string[]
  preprocessFunc?: PreprocessFuncName
  outputLabels: string[] // length defines the number of output neurons
  storeBatchSize?: number // default: 100
  isUserGenerated?: boolean
  camProps?: DsCamProps
  mapProps?: DsMapProps
  loaded: "preview" | "full" // will be set by ds loader
  model?: ModelDef // default model to load for this dataset
  externalSamples?: ExternalSample[] // test models with external images
  isModelDs?: boolean // tile gets "model" tag instead of "dataset"
  sampleViewer?: boolean // show sample viewer instead of sample slider
  targetDevice?: "desktop" | "mobile" // to load smaller model versions on mobile
  tokenizerName?: TokenizerName
}

interface ExternalSample {
  url: string
  label: string
  // y?: number
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
  storeBatchSize: number
  train: StoreMeta
  test: StoreMeta
  preprocess?: PreprocessFunc
  tokenizer?: TokenizerType
}

interface DsMapProps {
  center: [number, number]
  zoom: number
  baseLayer?: GeoJSON.FeatureCollection | GeoJSON.GeometryCollection | string // URL
}

interface DsCamProps {
  aspectRatio?: number
  videoConstraints?: MediaTrackConstraints // { width: number, height: number } to avoid manual resizing
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
  X: number[] | SupportedTypedArray
  y?: number
  rawX?: number[] | SupportedTypedArray
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

// supported typed arrays for tensorflow.js: https://js.tensorflow.org/api/latest/#tensor
export type SupportedTypedArray = Uint8Array | Int32Array | Float32Array

type ParsedSafe = Parsed & { data: SupportedTypedArray }

export function isSafe(parsed: Parsed): parsed is ParsedSafe {
  return (
    parsed.data instanceof Uint8Array ||
    parsed.data instanceof Int32Array ||
    parsed.data instanceof Float32Array
  )
}
