import { useCallback, useEffect } from "react"
import { useStatusText } from "@/components/status"
import * as tf from "@tensorflow/tfjs"
import { debug } from "./debug"
import { create } from "zustand"
import { useKeyCommand } from "./utils"
import { datasets } from "@/datasets"

interface DatasetData {
  trainX: tf.Tensor<tf.Rank>
  trainY: tf.Tensor<tf.Rank>
  testX?: tf.Tensor<tf.Rank>
  testY?: tf.Tensor<tf.Rank>
  trainXRaw?: tf.Tensor<tf.Rank>
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
  }
  output: {
    size: number
    activation: "softmax" | "linear"
    labels?: string[]
  }
  loadData: () => Promise<DatasetData>
}

export type Dataset = Omit<DatasetDef, "loadData"> & {
  dataRaw?: DatasetData
  data: DatasetData
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
      const totalSamples = ds?.data.trainX.shape[0] ?? 0
      const i = Math.floor(Math.random() * totalSamples) || 1
      return { ds, i }
    }),
  get totalSamples() {
    return get().ds?.data.trainX.shape[0] || 0
  },
  get isRegression() {
    return get().ds?.output.activation === "linear"
  },

  i: 1,
  setI: (arg) =>
    set(({ i }) => {
      const newI = typeof arg === "function" ? arg(i) : arg
      return { i: newI }
    }),
  next: (step = 1) =>
    set(({ i, totalSamples }) => ({
      i: ((i - 1 + step + totalSamples) % totalSamples) + 1,
    })),

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
    const datasetDef = datasets.find((d) => d.name === datasetKey)
    if (!datasetDef) return
    let dataRef: DatasetData | undefined = undefined
    datasetDef.loadData().then((data) => {
      dataRef = data
      if (debug()) console.log("loaded dataset", datasetKey)
      setDs({
        ...datasetDef,
        data,
      })
    })
    return () => {
      if (dataRef) {
        Object.values(dataRef).forEach((t) => t?.dispose())
      }
      setDs(undefined)
      useDatasetStore.setState({ input: undefined, rawInput: undefined })
    }
  }, [datasetKey, setStatusText, setDs, setI])

  useEffect(() => {
    if (!ds) return
    async function getInput() {
      if (!ds || !i) return [undefined, undefined, undefined] as const
      const { trainX, trainXRaw, trainY } = ds.data
      const [, ...dims] = trainX.shape
      const valsPerSample = dims.reduce((a, b) => a * b, 1)
      const index = i - 1
      const [inp, inpRaw, y] = tf.tidy(() => {
        const isOneHot = ds?.output.activation === "softmax"
        const inp = trainX
          .slice([index, 0], [1, ...dims])
          .reshape([valsPerSample]) as tf.Tensor1D
        const inpRaw = trainXRaw
          ?.slice([index, 0], [1, ...dims])
          .reshape([valsPerSample]) as tf.Tensor1D
        const y = isOneHot
          ? (trainY
              .slice([i - 1, 0], [1, ds.output.size])
              .argMax(-1) as tf.Tensor1D)
          : (trainY.slice([i - 1], [1]) as tf.Tensor1D)
        return [inp, inpRaw, y] as const
      })
      try {
        const input = await inp.array()
        const rawInput = await inpRaw?.array()
        const yArr = await y.array()
        const trainingY = Array.isArray(yArr)
          ? yArr[0]
          : (yArr as number | undefined)
        useDatasetStore.setState({ input, rawInput, trainingY })
      } catch (e) {
        console.log("Error getting input", e)
      } finally {
        inp.dispose()
        inpRaw?.dispose()
        y.dispose()
      }
    }
    getInput()
  }, [i, ds])

  const next = useDatasetStore((s) => s.next)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev)
  useKeyCommand("ArrowRight", next)

  return [ds, next] as const
}
