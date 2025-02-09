import { useEffect } from "react"
import { useStatusText } from "@/components/status"
import * as tf from "@tensorflow/tfjs"
import { create } from "zustand"
import { datasets } from "@/datasets"
import { getData, putData, putDataBatches } from "./indexed-db"
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
  xTrainRaw?: ParsedLike
  xTestRaw?: ParsedLike
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
  version: Date
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
  version: Date
  shapeX: number[]
  shapeY: number[]
  storeBatchSize: number
  valsPerSample: number
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
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

export const useDatasetStore = create<DatasetStore>((set) => ({
  datasetKey: undefined, // datasets[0].name, //
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) =>
    set(() => {
      const totalSamples = ds?.train.shapeX[0] ?? 0
      const i = Math.floor(Math.random() * totalSamples - 1)
      const isRegression = ds?.task === "regression"
      return { ds, i, totalSamples, isRegression }
    }),
  totalSamples: 0,
  isRegression: false,

  i: 0,
  setI: (arg) =>
    set(({ i }) => {
      const newI = typeof arg === "function" ? arg(i) : arg
      return { i: newI }
    }),
  next: (step = 1) =>
    set(({ i, totalSamples }) => {
      return {
        i: (i + step + totalSamples) % totalSamples,
      }
    }),

  // maybe move to separate store (current state + activations ...)
  input: undefined,
  rawInput: undefined,
  trainingY: undefined,
}))

export function useDatasets() {
  const datasetKey = useDatasetStore((s) => s.datasetKey)
  const ds = useDatasetStore((s) => s.ds)
  const setDs = useDatasetStore((s) => s.setDs)
  const setStatusText = useStatusText((s) => s.setStatusText)

  useEffect(() => {
    const dsDef = datasets.find((d) => d.key === datasetKey)
    if (!dsDef) return

    loadData()
    async function loadData() {
      if (!dsDef) return
      const existingTrain = await getData<StoreMeta>(dsDef.key, "meta", "train")
      const hasLatestData =
        existingTrain?.version.getTime() === dsDef.version.getTime()
      if (existingTrain && !hasLatestData) {
        console.log("old data in indexedDB, updating ...")
      }
      if (existingTrain && hasLatestData) {
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
        console.log("loading new data into indexedDB ...")
        const { version } = dsDef
        const { xTrain, yTrain, xTest, yTest, xTrainRaw, xTestRaw } =
          await dsDef.loadData()
        await saveData(dsDef.key, "train", xTrain, yTrain, xTrainRaw, version)
        await saveData(dsDef.key, "test", xTest, yTest, xTestRaw, version)
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

    return () => {
      setDs(undefined)
      useDatasetStore.setState({ input: undefined, rawInput: undefined })
    }
  }, [datasetKey, setStatusText, setDs])

  return ds
}

export interface DbBatch {
  index: number
  xs: ParsedLike["data"]
  ys: ParsedLike["data"]
  xsRaw?: ParsedLike["data"]
}

async function saveData(
  dbName: DatasetKey,
  storeName: "train" | "test",
  xs: ParsedLike,
  ys: ParsedLike,
  xsRaw: ParsedLike | undefined,
  version: Date,
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
    const batchXsRaw = xsRaw?.data.slice(
      i * valsPerSample,
      (i + storeBatchSize) * valsPerSample
    )
    const batchYs = ys.data.slice(i, i + storeBatchSize)
    const batch = {
      index: batchIdx,
      xs: batchXs,
      ys: batchYs,
      xsRaw: batchXsRaw,
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
  console.log("IndexedDB putDataBatches time:", Date.now() - startTime)
}
