import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { Dataset, getStoreName } from "./datasets"
import { useStatusText } from "@/components/status"
import { TrainingLog, useLogStore } from "@/ui-components/logs-plot"
import { create } from "zustand"
import { useKeyCommand } from "./utils"
import { setBackendIfAvailable } from "./tf-backend"
import { getAll } from "./indexed-db"

let epochCount = 0
let sessionEpochCount = 0
let sessionBatchCount = 0
let trainingPromise: Promise<tf.History | void> | null = null

interface TrainingConfig {
  batchSize: number
  epochs: number
  validationSplit: number
  silent: boolean
}

const defaultConfig = {
  batchSize: 256,
  epochs: 3,
  validationSplit: 0.1,
  silent: true,
}

interface TrainingStore {
  isTraining: boolean
  setIsTraining: (val: boolean) => void
  toggleTraining: () => void
  batchCounter: number
  setBatchCounter: (arg: number | ((prev: number) => number)) => void
  config: TrainingConfig
  setConfig: (newConfig: Partial<TrainingConfig>) => void
}

export const useTrainingStore = create<TrainingStore>((set) => ({
  isTraining: false,
  setIsTraining: (isTraining) => set({ isTraining }),
  toggleTraining: () => set((s) => ({ isTraining: !s.isTraining })),
  batchCounter: 0,
  setBatchCounter: (arg) =>
    set(({ batchCounter }) => {
      const newVal = typeof arg === "function" ? arg(batchCounter) : arg
      return { batchCounter: newVal }
    }),
  config: defaultConfig,
  setConfig: (newConfig) =>
    set(({ config }) => ({ config: { ...config, ...newConfig } })),
}))

export function useTraining(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  next: (step?: number) => void
) {
  const {
    isTraining,
    setIsTraining,
    toggleTraining,
    batchCounter,
    setBatchCounter,
    config,
  } = useTrainingStore()

  const setStatusText = useStatusText((s) => s.setStatusText)

  useKeyCommand("t", toggleTraining)

  const setLogs = useLogStore((s) => s.setLogs)

  useEffect(() => {
    // reset training state
    epochCount = 0
    setBatchCounter(0)
    setLogs([] as TrainingLog[])
    setIsTraining(false)
  }, [model, setLogs, setBatchCounter, setIsTraining])

  useEffect(() => {
    if (!isTraining || !ds || !model) {
      trainingPromise = null
      return
    }
    const { validationSplit, batchSize, epochs: _epochs, silent } = config
    const totalSamples = ds.train.shapeX[0]
    const trainSampleSize = Math.floor(totalSamples * (1 - validationSplit))
    const isNewSession = !trainingPromise
    if (isNewSession) {
      sessionEpochCount = 0
      sessionBatchCount = 0
    }
    const initialEpoch = epochCount > 0 ? epochCount : 0
    const epochs = initialEpoch + _epochs - sessionEpochCount
    async function startTraining() {
      if (!model || !ds) return
      // use wegpu for silent training (faster)
      if (silent) await setBackendIfAvailable("webgpu")
      let startTime = Date.now()
      const epochBatches = Math.ceil(trainSampleSize / batchSize)
      const totalBatches = _epochs * epochBatches
      const isLastBatch = (batchIndex: number) =>
        batchIndex === epochBatches - 1
      const isLastEpoch = () => epochCount === epochs - 1
      let trainingComplete = false
      const callbacks: tf.ModelFitArgs["callbacks"] = {
        onBatchBegin: (batchIndex) => {
          const remainingSamples = trainSampleSize - batchIndex * batchSize
          const step =
            isLastEpoch() && isLastBatch(batchIndex)
              ? remainingSamples - 1 // stop on last sample
              : isLastBatch(batchIndex)
              ? remainingSamples % batchSize
              : batchSize
          if (!silent) {
            next(step) // trigger view update
            setBatchCounter((prev) => prev + 1) // trigger model update
          }
        },
        onBatchEnd: (batchIndex, logs) => {
          sessionBatchCount++
          const percent = sessionBatchCount / totalBatches
          if (isLastBatch(batchIndex)) sessionEpochCount++
          if (isLastEpoch() && isLastBatch(batchIndex)) trainingComplete = true
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch: epochCount, ...logs }])
          setStatusText(
            {
              title: "Training ...",
              data: {
                Epoch: `${epochCount + 1}/${epochs}`,
                Batch: `${batchIndex + 1}/${epochBatches}`,
              },
            },
            { percent }
          )
        },
        onEpochBegin: (epoch) => {
          epochCount = epoch
        },
        onEpochEnd: (epoch, logs) => {
          if (typeof logs !== "undefined")
            setLogs((prev) => [...prev, { epoch, ...logs }])
        },
        onTrainBegin: () => {
          startTime = Date.now()
        },
        onTrainEnd: async () => {
          const endTime = Date.now()
          const totalTime = (endTime - startTime) / 1000
          if (silent) {
            const processedSamples = trainSampleSize - 1
            next(processedSamples) // update view
            setBatchCounter((c) => c + processedSamples) // update weights
          }
          const { accuracy, loss } = await getModelEvaluation(model, ds)
          if (!trainingPromise || trainingComplete) {
            const data = {
              Loss: loss?.toFixed(3),
              Accuracy: accuracy?.toFixed(3),
              Time: `${totalTime.toFixed(2)}s`,
            }
            const backend = tf.getBackend()
            setStatusText(
              { title: `Training finished (${backend})`, data },
              { percent: null }
            )
          }
          if (trainingComplete) {
            epochCount++
            trainingPromise = null
            setIsTraining(false)
          }
        },
      }
      const options = {
        batchSize,
        epochs,
        validationSplit,
        callbacks,
        initialEpoch,
      }
      await train(model, ds, options)
      await setBackendIfAvailable("webgl")
    }
    startTraining()
    return () => {
      model.stopTraining = true
    }
  }, [
    model,
    isTraining,
    next,
    setStatusText,
    config,
    ds,
    setLogs,
    setBatchCounter,
    setIsTraining,
  ])

  return [isTraining, batchCounter] as const
}

type FitArgs = tf.ModelFitArgs // tf.ModelFitDatasetArgs<tf.Tensor<tf.Rank>[]>

const defaultOptions: FitArgs = {
  batchSize: 1,
  epochs: 1,
  validationSplit: 0,
  shuffle: true,
}

async function train(
  model: tf.LayersModel,
  ds: Dataset,
  options: FitArgs = { epochs: 1, batchSize: 1 }
) {
  if (trainingPromise) {
    console.log("Changing ongoing training ...")
    await trainingPromise
    trainingPromise = null
  }

  options = { ...defaultOptions, ...options }

  // const X = ds.data.trainX
  // const y = ds.data.trainY
  const [X, y] = await getDbDataAsTensors(ds, "train")

  try {
    // TODO: fitDataset ...
    trainingPromise = model.fit(X, y, options)
    const history = await trainingPromise
    return history
  } finally {
    // TODO: maybe cache?
    X.dispose()
    y.dispose()
  }
}

async function getDbDataAsTensors(ds: Dataset, type: "train" | "test") {
  const storeName = getStoreName(ds, type)
  const samples = await getAll<{ data: number[]; label: number }>(storeName)
  // TODO: normalization ...
  return tf.tidy(() => {
    const _X = tf.tensor(
      samples.map((s) => s.data),
      ds[type].shapeX
    )
    const X = ds.input?.preprocess ? ds.input.preprocess(_X) : _X
    // TODO: regression ...
    const y = tf.oneHot(
      samples.map((s) => s.label),
      ds.output.size
    )
    return [X, y] as const
  })
}

export async function getModelEvaluation(model: tf.LayersModel, ds: Dataset) {
  if (!ds) return { loss: undefined, accuracy: undefined }

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
