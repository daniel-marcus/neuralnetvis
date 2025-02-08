import { useCallback, useEffect } from "react"
import { useStatusText } from "@/components/status"
import * as tf from "@tensorflow/tfjs"
import { debug } from "./debug"
import { create } from "zustand"
import { useKeyCommand } from "./utils"
import { datasets } from "@/datasets"
import { getData, putData, putDataBatches, storeHasEntries } from "./indexed-db"
import { SupportedTypedArray } from "./npy-loader"

// ParsedLike
interface ParsedLike {
  data: SupportedTypedArray
  shape: number[]
}

interface DatasetData {
  xTrain: ParsedLike
  yTrain: ParsedLike
  xTest: ParsedLike
  yTest: ParsedLike
}

export type DatasetKey =
  | "mnist"
  | "fashion_mnist"
  | "cifar10"
  | "california_housing"

export interface DatasetDef {
  key: DatasetKey
  name: string
  task: "classification" | "regression"
  description: string
  version: number
  disabled?: boolean
  aboutUrl: string
  loss: "categoricalCrossentropy" | "meanSquaredError"
  input?: {
    labels?: string[]
    preprocess?: <T extends tf.Tensor<tf.Rank>>(X: T) => T
  }
  output: {
    size: number
    activation: "softmax" | "linear"
    labels?: string[]
  }
  loadData: () => Promise<DatasetData>
}

interface StoreMeta {
  index: string // storeName: mnist_1_train
  version: number
  shapeX: number[]
  shapeY: number[]
  storeBatchSize: number
  valsPerSample: number
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
  dataRaw?: DatasetData
  data?: DatasetData
  train: StoreMeta
  test: StoreMeta
}

interface DatasetStore {
  datasetKey: string | undefined
  setDatasetKey: (key: string) => void
  ds: Dataset | undefined
  setDs: (ds: Dataset | undefined) => void
  totalSamples: number
  isRegression: boolean

  i: number // currentSampleIndex
  setI: (arg: number | ((prev: number) => number)) => void
  next: (step?: number) => void

  input: number[] | undefined
  rawInput: number[] | undefined
  trainingY: number | undefined
}

export const useDatasetStore = create<DatasetStore>((set, get) => ({
  datasetKey: undefined, // datasets[0].name, //
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) =>
    set(() => {
      const totalSamples = ds?.train.shapeX[0] ?? 0
      const max = Math.min(totalSamples, 1000) // first load is triggered with first 1000 samples only
      const i = Math.floor(Math.random() * max) || 1
      return { ds, i, totalSamples }
    }),
  totalSamples: 0,
  get isRegression() {
    // TODO: getter not working
    return get().ds?.output.activation === "linear"
  },

  i: 1,
  setI: (arg) =>
    set(({ i }) => {
      const newI = typeof arg === "function" ? arg(i) : arg
      return { i: newI }
    }),
  next: (step = 1) =>
    set(({ i, totalSamples }) => {
      return {
        i: ((i - 1 + step + totalSamples) % totalSamples) + 1,
      }
    }),

  // maybe move to separate store (current state + activations ...)
  input: undefined,
  rawInput: undefined,
  trainingY: undefined,
}))

let currBatchCache: DbBatch | null = null

export function useDatasets() {
  const datasetKey = useDatasetStore((s) => s.datasetKey)
  const ds = useDatasetStore((s) => s.ds)
  const setDs = useDatasetStore((s) => s.setDs)
  const i = useDatasetStore((s) => s.i)
  const setI = useDatasetStore((s) => s.setI)

  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    if (debug()) console.log("loading dataset", datasetKey)
    const dsDef = datasets.find((d) => d.name === datasetKey)
    if (!dsDef) return

    async function loadData() {
      if (!dsDef) return
      const exists = await storeHasEntries(dsDef.key, "meta")
      if (exists) {
        console.log("found data in indexedDB")
        const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
        const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
        if (!train || !test) {
          throw new Error("Failed to load indexedDB store")
        }
        setDs({
          ...dsDef,
          train,
          test,
        })
      } else {
        console.log("creating new indexedDB store ...")
        const { version } = dsDef
        const { xTrain, yTrain, xTest, yTest } = await dsDef.loadData()
        await putSamplesToDb(dsDef.key, "train", xTrain, yTrain, version)
        await putSamplesToDb(dsDef.key, "test", xTest, yTest, version)
        const train = await getData<StoreMeta>(dsDef.key, "meta", "train") // TODO: type keys
        const test = await getData<StoreMeta>(dsDef.key, "meta", "test")
        if (!train || !test) {
          throw new Error("Failed to create indexedDB store")
        }
        setDs({
          ...dsDef,
          train,
          test,
        })
      }
    }
    loadData()

    return () => {
      currBatchCache = null
      setDs(undefined)
      useDatasetStore.setState({ input: undefined, rawInput: undefined })
    }
  }, [datasetKey, setStatusText, setDs, setI])

  useEffect(() => {
    // useInput
    if (!ds) return
    async function getInput() {
      if (!ds) return
      const { storeBatchSize, valsPerSample } = ds.train
      const batchIdx = Math.floor(i / storeBatchSize)
      const batch =
        currBatchCache?.index === batchIdx
          ? currBatchCache
          : await getData<DbBatch>(ds.key, "train", batchIdx)
      if (!batch) return
      const sampleIdx = i % storeBatchSize
      const data = batch?.xs.slice(
        sampleIdx * valsPerSample,
        (sampleIdx + 1) * valsPerSample
      )
      const label = batch?.ys[sampleIdx]
      const rawInput = Array.from(data)
      const input = tf.tidy(() =>
        ds.input?.preprocess
          ? (ds.input.preprocess(tf.tensor(data)).arraySync() as number[])
          : rawInput
      )
      const trainingY = label
      useDatasetStore.setState({ input, rawInput, trainingY })
    }
    getInput()
    return
  }, [i, ds])

  const next = useDatasetStore((s) => s.next)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev)
  useKeyCommand("ArrowRight", next)

  return [ds, next] as const
}

export interface DbBatch {
  index: number
  xs: ParsedLike["data"]
  ys: ParsedLike["data"]
}

async function putSamplesToDb(
  dbName: DatasetKey,
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  version: number,
  storeBatchSize = 100
) {
  const [totalSamples, ...dims] = xs.shape
  const valsPerSample = dims.reduce((a, b) => a * b)

  const startTime = Date.now()
  const batches: DbBatch[] = []
  for (let i = 0; i < totalSamples; i += storeBatchSize) {
    const batchIdx = Math.floor(i / storeBatchSize)
    const batchXs = xs.data.slice(
      i * valsPerSample,
      (i + storeBatchSize) * valsPerSample
    )
    const batchYs = ys.data.slice(i, i + storeBatchSize)
    const batch = {
      index: batchIdx,
      xs: batchXs,
      ys: batchYs,
    }
    batches.push(batch)
  }
  await putDataBatches(dbName, storeName, batches)
  console.log("batches", batches.length)
  await putData<StoreMeta>(dbName, "meta", {
    index: storeName,
    version,
    shapeX: xs.shape,
    shapeY: ys.shape,
    storeBatchSize,
    valsPerSample,
  })
  console.log("IndexedDB putDataBatch time:", Date.now() - startTime)
}
