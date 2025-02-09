import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { Dataset, DbBatch, useDatasetStore } from "@/data/datasets"
import { useLogStore } from "@/ui-components/logs-plot"
import { create } from "zustand"
import { useKeyCommand } from "@/lib/utils"
import { setBackendIfAvailable } from "./tf-backend"
import { getAll } from "@/data/indexed-db"
import { useModelStore } from "./model"
import { LogsPlotCb, ProgressCb, UpdateCb } from "./training-callbacks"
import { getSample } from "@/data/input"

interface TrainingConfig {
  batchSize: number
  epochs: number
  validationSplit: number
  silent: boolean
  fitDataset: boolean // TODO: find a better name
}

interface TrainingStore {
  config: TrainingConfig
  setConfig: (newConfig: Partial<TrainingConfig>) => void
  isTraining: boolean
  setIsTraining: (val: boolean) => void
  toggleTraining: () => void
  trainingPromise: Promise<tf.History | void> | null
  batchCount: number
  setBatchCount: (arg: number | ((prev: number) => number)) => void
  epochCount: number
  setEpochCount: (val: number) => void
  reset: () => void
}

export const useTrainingStore = create<TrainingStore>((set) => ({
  config: {
    batchSize: 128,
    epochs: 3,
    validationSplit: 0.1,
    silent: true,
    fitDataset: false,
  },
  setConfig: (newConfig) =>
    set(({ config }) => ({ config: { ...config, ...newConfig } })),

  isTraining: false,
  setIsTraining: (isTraining) => set({ isTraining }),
  toggleTraining: () => set((s) => ({ isTraining: !s.isTraining })),
  trainingPromise: null,

  batchCount: 0,
  setBatchCount: (arg) =>
    set(({ batchCount }) => ({
      batchCount: typeof arg === "function" ? arg(batchCount) : arg,
    })),
  epochCount: 0,
  setEpochCount: (epochCount) => set({ epochCount }),
  reset: () => {
    useLogStore.getState().setLogs([])
    set({ isTraining: false, batchCount: 0, epochCount: 0 })
  },
}))

export function useTraining(model?: tf.LayersModel, ds?: Dataset) {
  const { isTraining, toggleTraining, batchCount, config } = useTrainingStore()
  useKeyCommand("t", toggleTraining)
  useEffect(() => useTrainingStore.getState().reset(), [model])

  useEffect(() => {
    if (!isTraining || !ds || !model) return
    const { validationSplit, batchSize, epochs: _epochs, silent } = config
    const initialEpoch = useTrainingStore.getState().epochCount
    const epochs = initialEpoch + _epochs

    startTraining()
    async function startTraining() {
      if (!model || !ds) return
      if (silent) await setBackendIfAvailable("webgpu") // use webgpu for silent training (faster)
      const callbacks = [new UpdateCb(), new ProgressCb(), new LogsPlotCb()]
      await train(model, ds, {
        batchSize,
        epochs,
        initialEpoch,
        validationSplit,
        callbacks,
      })
      await setBackendIfAvailable("webgl")
    }
    return () => {
      model.stopTraining = true
    }
  }, [model, isTraining, config, ds])

  return [isTraining, batchCount] as const
}

type FitArgs = {
  batchSize: number
  epochs: number
  initialEpoch: number
  validationSplit: number
  callbacks: tf.ModelFitArgs["callbacks"]
}
// type FitArgs = tf.ModelFitArgs
// type FitArgs = tf.ModelFitDatasetArgs<tf.Tensor<tf.Rank>[]>

async function* dataGenerator(ds: Dataset, type: "train" | "test") {
  const isRegression = useDatasetStore.getState().isRegression
  const totalSamples = ds[type].shapeX[0]
  let i = 0
  while (i < totalSamples) {
    const [_X, y] = await getSample(ds, type, i)
    yield tf.tidy(() => {
      const shape = [1, ...ds[type].shapeX.slice(1)]
      const xs =
        ds.input?.preprocess?.(tf.tensor(_X, shape)) ?? tf.tensor(_X, shape)
      const ys = isRegression ? tf.tensor(y) : tf.oneHot(y, ds.output.size)
      return { xs, ys }
    })
    i++
  }
}

async function train(model: tf.LayersModel, ds: Dataset, options: FitArgs) {
  const ongoingTraining = useTrainingStore.getState().trainingPromise
  if (ongoingTraining) {
    console.log("Changing ongoing training ...")
    await ongoingTraining
    useTrainingStore.setState({ trainingPromise: null })
  }

  const isFitDataset = useTrainingStore.getState().config.fitDataset

  let history: tf.History | void | undefined = undefined
  if (!isFitDataset) {
    const [X, y] = await getDbDataAsTensors(ds, "train")
    const trainingPromise = model.fit(X, y, options)
    useTrainingStore.setState({ trainingPromise })
    history = await trainingPromise.then(() => {
      X.dispose()
      y.dispose()
    })
  } else {
    // test: with fitDataset ...
    const { batchSize, validationSplit, ...otherOptions } = options
    const dataset = tf.data.generator(() => dataGenerator(ds, "train"))

    const totalSamples = ds.train.shapeX[0]
    const validationSize = Math.floor(totalSamples * validationSplit)
    const trainSize = totalSamples - validationSize
    const trainDataset = dataset.take(trainSize).batch(batchSize)
    const validationDataset = dataset.skip(trainSize).batch(batchSize)

    const trainingPromise = model.fitDataset(trainDataset, {
      ...otherOptions,
      validationData: validationDataset,
    })
    // TODO: dispose tensors ?
    history = await trainingPromise
  }

  return history
}

async function getDbDataAsTensors(ds: Dataset, type: "train" | "test") {
  const batches = await getAll<DbBatch>(ds.key, type)
  const isRegression = useDatasetStore.getState().isRegression
  return tf.tidy(() => {
    const xBatchTensors = batches.map((b) => tf.tensor(b.xs))
    const XRaw = tf.concat(xBatchTensors).reshape(ds[type].shapeX)
    const X = ds.input?.preprocess?.(XRaw) ?? XRaw
    const yArr = batches.flatMap((b) => Array.from(b.ys))
    const y = isRegression ? tf.tensor(yArr) : tf.oneHot(yArr, ds.output.size)
    return [X, y] as const
  })
}

export async function getModelEvaluation() {
  const model = useModelStore.getState().model
  const ds = useDatasetStore.getState().ds
  if (!ds || !model) return { loss: undefined, accuracy: undefined }

  const [X, y] = await getDbDataAsTensors(ds, "test")

  await tf.ready()
  const result = model.evaluate(X, y, { batchSize: 64 })
  const [lossT, accuracyT] = Array.isArray(result) ? result : [result]
  try {
    const loss = await lossT.array()
    const accuracy = await accuracyT?.array()
    return { loss, accuracy }
  } catch (e) {
    console.warn(e)
    return { loss: undefined, accuracy: undefined }
  } finally {
    X.dispose()
    y.dispose()
    lossT.dispose()
    accuracyT?.dispose()
  }
}
