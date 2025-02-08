import { useCallback, useEffect } from "react"
import { useStatusText } from "@/components/status"
import * as tf from "@tensorflow/tfjs"
import { debug } from "./debug"
import { create } from "zustand"
import { useKeyCommand } from "./utils"
import { datasets } from "@/datasets"
import { Parsed } from "npyjs"
import {
  getData,
  putData,
  putDataBatch,
  storeExistsAndHasEntries,
} from "./indexed-db"

// ParsedLike
interface ParsedLike {
  data: Parsed["data"]
  shape: number[]
}

interface DatasetData {
  xTrain: ParsedLike
  yTrain: ParsedLike
  xTest: ParsedLike
  yTest: ParsedLike
}

export interface DatasetDef {
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

const DS_META_STORE = "_ds_meta"

export const useDatasetStore = create<DatasetStore>((set, get) => ({
  datasetKey: undefined, // datasets[0].name, //
  setDatasetKey: (key) => set({ datasetKey: key }),
  ds: undefined,
  setDs: (ds) =>
    set(() => {
      const totalSamples = ds?.train.shapeX[0] ?? 0
      const i = Math.floor(Math.random() * totalSamples) || 1
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
      const trainStoreName = getStoreName(dsDef, "train")
      const testStoreName = getStoreName(dsDef, "test")
      const trainStoreMeta = await getData<StoreMeta>(
        DS_META_STORE,
        trainStoreName
      )
      const testStoreMeta = await getData<StoreMeta>(
        DS_META_STORE,
        testStoreName
      )
      const hasData = await storeExistsAndHasEntries(trainStoreName)
      console.log({
        trainStoreMeta,
        testStoreMeta,
        hasData,
        trainStoreName,
        testStoreName,
      })
      // TODO: add version check
      if (trainStoreMeta && testStoreMeta && hasData) {
        console.log("found data in indexedDB")
        setDs({
          ...dsDef,
          train: trainStoreMeta,
          test: testStoreMeta,
        })
      } else {
        console.log("creating new indexedDB store ...")
        const { version } = dsDef
        const { xTrain, yTrain, xTest, yTest } = await dsDef.loadData()
        await putSamplesToDb(trainStoreName, xTrain, yTrain, version)
        await putSamplesToDb(testStoreName, xTest, yTest, version)
        const trainStoreMeta = await getData<StoreMeta>(
          DS_META_STORE,
          trainStoreName
        )
        const testStoreMeta = await getData<StoreMeta>(
          DS_META_STORE,
          testStoreName
        )
        if (!trainStoreMeta || !testStoreMeta) {
          throw new Error("Failed to create indexedDB store")
        }
        setDs({
          ...dsDef,
          train: trainStoreMeta,
          test: testStoreMeta,
        })
      }
    }
    loadData()

    return () => {
      setDs(undefined)
      useDatasetStore.setState({ input: undefined, rawInput: undefined })
    }
  }, [datasetKey, setStatusText, setDs, setI])

  useEffect(() => {
    if (!ds) return
    async function getInput() {
      if (!ds) return
      const storeName = getStoreName(ds, "train")
      // TODO: add types (TypedArary, Float32Array, ...)
      const sample = await getData<{
        data: number[] | Uint8Array | Float32Array
        label: number | undefined
      }>(storeName, i)
      if (!sample) return
      const { data, label } = sample
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

export function getStoreName(ds: DatasetDef | Dataset, type: "train" | "test") {
  return `${ds.name}_${type}`
}

async function putSamplesToDb(
  storeName: string,
  xs: ParsedLike,
  ys: ParsedLike,
  version: number,
  batchSize = 500
) {
  const [length, ...dims] = xs.shape
  const valsPerSample = dims.reduce((a, b) => a * b)
  const samples = Array.from({ length }).map((_, index) => {
    const data = xs.data.slice(
      index * valsPerSample,
      (index + 1) * valsPerSample
    )
    const label = ys.data[index]
    return { index, data, label }
  })
  const startTime = Date.now()
  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, i + batchSize)
    await putDataBatch(storeName, batch)
  }
  await putData<StoreMeta>(DS_META_STORE, storeName, {
    index: storeName,
    version,
    shapeX: xs.shape,
    shapeY: ys.shape,
  })
  console.log("IndexedDB putDataBatch time:", Date.now() - startTime)
}
