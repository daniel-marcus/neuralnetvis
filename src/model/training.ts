import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useKeyCommand } from "@/utils/key-command"
import { backendForTraining, setBackend } from "./tf-backend"
import { getAll } from "@/data/db"
import { UpdateCb, ProgressCb, LogsPlotCb, DebugCb } from "./training-callbacks"
import { getDbDataAsTensors } from "@/data/dataset"
import {
  getDs,
  getModel,
  useGlobalStore,
  isDebug,
  useSceneStore,
} from "@/store"
import type { Dataset, DbBatch } from "@/data"

export function useTraining(model?: tf.LayersModel, ds?: Dataset) {
  const isTraining = useSceneStore((s) => s.isTraining)
  const toggleTraining = useSceneStore((s) => s.toggleTraining)
  const batchCount = useSceneStore((s) => s.batchCount)
  const config = useSceneStore((s) => s.trainConfig)
  const isActive = useSceneStore((s) => s.isActive)
  useKeyCommand("t", toggleTraining, isActive)
  const resetTrainCounts = useSceneStore((s) => s.resetTrainCounts)
  useEffect(() => resetTrainCounts(), [model, resetTrainCounts])
  useEffect(() => {
    if (!isTraining || !ds || !model) return
    const { validationSplit, batchSize, epochs: _epochs } = config
    const initialEpoch = useGlobalStore.getState().scene.getState().epochCount
    const epochs = initialEpoch + _epochs

    startTraining()
    async function startTraining() {
      if (!model || !ds) return
      if (!isDebug()) await backendForTraining()
      const callbacks = [
        new DebugCb(),
        new UpdateCb(),
        new ProgressCb(),
        new LogsPlotCb(),
      ]
      await train(model, ds, {
        batchSize,
        epochs,
        initialEpoch,
        validationSplit,
        callbacks,
      })
      if (!isDebug()) await setBackend() // to default
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

export interface TensorBatch {
  xs: tf.Tensor
  ys: tf.Tensor
  [key: string]: tf.Tensor
}

function getStoreBatchIdx(sampleIdx: number, storeBatchSize: number) {
  return Math.floor(sampleIdx / storeBatchSize)
}

export async function getSamplesAsBatch(
  ds: Dataset,
  newBatchSize: number,
  newBatchIdx: number
): Promise<TensorBatch> {
  const type = "train"
  const valsPerSample = ds.inputDims.reduce((a, b) => a * b)
  const { storeBatchSize } = ds

  const firstSampleIdx = newBatchIdx * newBatchSize
  const lastSampleIdx = firstSampleIdx + newBatchSize - 1 // add range check (trainSamples)?
  const storeStartIdx = getStoreBatchIdx(firstSampleIdx, storeBatchSize)
  const storeEndIdx = getStoreBatchIdx(lastSampleIdx, storeBatchSize)
  const keyRange = IDBKeyRange.bound(storeStartIdx, storeEndIdx)
  const dbBatches = await getAll<DbBatch>(ds.key, type, keyRange)

  const firstIdxInStoreBatch = firstSampleIdx % storeBatchSize

  return tf.tidy(() => {
    const allYs = dbBatches.flatMap((b) => Array.from(b.ys))
    const slicedYs = allYs.slice(
      firstIdxInStoreBatch,
      firstIdxInStoreBatch + newBatchSize
    )
    const currBatchSize = Math.min(newBatchSize, slicedYs.length) // last batch may have less samples
    const shapeX = [currBatchSize, ...ds.inputDims]
    const xTensors = dbBatches.map((b) => tf.tensor(b.xs))
    const _xs = tf
      .concat(xTensors)
      .flatten()
      .slice(
        firstIdxInStoreBatch * valsPerSample,
        currBatchSize * valsPerSample
      )
      .reshape(shapeX)
    const xs = ds.preprocess?.(_xs) ?? _xs
    const ys =
      ds.task === "classification"
        ? tf.oneHot(slicedYs, ds.outputLabels.length)
        : tf.tensor(slicedYs) // regression
    return { xs, ys }
  })
}

function makeGenerator(
  ds: Dataset,
  trainBatchSize: number,
  totalSamples: number
) {
  const totalBatches = Math.ceil(totalSamples / trainBatchSize)

  return async function* dataGenerator() {
    let trainBatchIdx = 0
    while (trainBatchIdx < totalBatches) {
      yield getSamplesAsBatch(ds, trainBatchSize, trainBatchIdx)
      trainBatchIdx++
    }
  }
}

export function canUseLazyLoading(ds: Dataset) {
  // regression: model.fit() works better that fitDataset() due to integrated shuffling
  return ds.task !== "regression"
}

async function train(model: tf.LayersModel, ds: Dataset, options: FitArgs) {
  const ongoingTraining = useGlobalStore
    .getState()
    .scene.getState().trainingPromise
  if (ongoingTraining) {
    console.log("Changing ongoing training ...")
    await ongoingTraining
    // useGlobalStore.setState({ trainingPromise: null })
  }

  const _lazyLoading = useGlobalStore.getState().scene.getState()
    .trainConfig.lazyLoading

  const lazyLoading = canUseLazyLoading(ds) && _lazyLoading

  let history: tf.History | void | undefined = undefined
  if (!lazyLoading) {
    const trainData = await getDbDataAsTensors(ds, "train")
    if (!trainData) return
    const { X, y } = trainData
    const trainingPromise = model.fit(X, y, options)
    useGlobalStore.getState().scene.setState({ trainingPromise })
    history = await trainingPromise.then(() => {
      Object.values(trainData).forEach((t) => t?.dispose())
    })
  } else {
    // with fitDataset / lazyLoading
    const { batchSize, validationSplit, ...otherOptions } = options

    // TODO splitDataset as function
    const totalSamples = ds.train.totalSamples
    const validationSamples = Math.floor(totalSamples * validationSplit)
    const trainSamples = totalSamples - validationSamples

    const generator = makeGenerator(ds, batchSize, totalSamples)
    const dataset = tf.data.generator(generator)

    const batchesPerEpoch = Math.ceil(trainSamples / batchSize)
    const trainDataset = dataset
      .take(batchesPerEpoch)
      .repeat(otherOptions.epochs)

    const firstValidationIdx = trainSamples
    const validStoreBatchIdx = getStoreBatchIdx(
      firstValidationIdx,
      ds.storeBatchSize
    )
    const range = IDBKeyRange.lowerBound(validStoreBatchIdx)
    const validationData = validationSamples
      ? await getDbDataAsTensors(ds, "train", { range })
      : undefined
    // const validationDataset = dataset.skip(trainSteps) <- slow

    const trainingPromise = model.fitDataset(trainDataset, {
      ...otherOptions,
      batchesPerEpoch,
      validationData: validationData
        ? [validationData.X, validationData.y]
        : undefined,
    })

    useGlobalStore.getState().scene.setState({ trainingPromise })
    history = await trainingPromise?.then(() => {
      Object.values(validationData ?? {}).forEach((t) => t?.dispose())
    })
  }
  return history
}

export async function trainOnBatch(xs: number[][], ys: number[]) {
  const ds = getDs()
  const setBatchCount = useGlobalStore.getState().scene.getState().setBatchCount
  const model = getModel()
  if (!ds || !model) return
  const isClassification = ds?.task === "classification"
  const trainShape = model.layers[0].batchInputShape as number[]
  const [X, y] = tf.tidy(() => {
    const X = tf.tensor(xs, [xs.length, ...trainShape.slice(1)]) // input already preprocessed
    const y = isClassification
      ? tf.oneHot(ys, ds.outputLabels.length)
      : tf.tensor(ys)
    return [X, y]
  })
  const [loss, acc] = (await model.trainOnBatch(X, y)) as number[]
  setBatchCount((prev) => prev + 1)
  X.dispose()
  y.dispose()
  return { loss, acc }
}
