import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useKeyCommand } from "@/utils/key-command"
import { backendForTraining, setBackendIfAvailable } from "./tf-backend"
import { getAll } from "@/data/db"
import { UpdateCb, ProgressCb, LogsPlotCb, DebugCb } from "./training-callbacks"
import { getDs, getModel, useStore, isDebug } from "@/store"
import type { Dataset, DbBatch } from "@/data"

export function useTraining(model?: tf.LayersModel, ds?: Dataset) {
  const isTraining = useStore((s) => s.isTraining)
  const toggleTraining = useStore((s) => s.toggleTraining)
  const batchCount = useStore((s) => s.batchCount)
  const config = useStore((s) => s.trainConfig)
  useKeyCommand("t", toggleTraining)
  useEffect(() => useStore.getState().resetTrainCounts(), [model])
  useEffect(() => {
    if (!isTraining || !ds || !model) return
    const { validationSplit, batchSize, epochs: _epochs } = config
    const initialEpoch = useStore.getState().epochCount
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
      if (!isDebug()) await setBackendIfAvailable() // to default
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
  const { storeBatchSize, valsPerSample } = ds[type]

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
    const shapeX = [currBatchSize, ...ds[type].shapeX.slice(1)]
    const xTensors = dbBatches.map((b) => tf.tensor(b.xs))
    const _xs = tf
      .concat(xTensors)
      .flatten()
      .slice(
        firstIdxInStoreBatch * valsPerSample,
        currBatchSize * valsPerSample
      )
      .reshape(shapeX)
    const xs = ds.input?.preprocess?.(_xs) ?? _xs
    const ys =
      ds.task === "classification"
        ? tf.oneHot(slicedYs, ds.output.size)
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

async function train(model: tf.LayersModel, ds: Dataset, options: FitArgs) {
  const ongoingTraining = useStore.getState().trainingPromise
  if (ongoingTraining) {
    console.log("Changing ongoing training ...")
    await ongoingTraining
    // useStore.setState({ trainingPromise: null })
  }

  const isFitDataset = useStore.getState().trainConfig.lazyLoading

  let history: tf.History | void | undefined = undefined
  if (!isFitDataset) {
    const trainData = await getDbDataAsTensors(ds, "train")
    if (!trainData) return
    const [X, y] = trainData
    const trainingPromise = model.fit(X, y, options)
    useStore.setState({ trainingPromise })
    history = await trainingPromise.then(() => {
      X.dispose()
      y.dispose()
    })
  } else {
    // with fitDataset / lazyLoading
    const { batchSize, validationSplit, ...otherOptions } = options

    // TODO splitDataset as function // validationData as tensor (faster)
    const totalSamples = ds.train.shapeX[0]
    const validationSamples = Math.floor(totalSamples * validationSplit)
    const trainSamples = totalSamples - validationSamples

    const generator = makeGenerator(ds, batchSize, totalSamples)
    const dataset = tf.data.generator(generator)

    const trainSteps = Math.ceil(trainSamples / batchSize)
    const trainDataset = dataset.take(trainSteps).repeat(otherOptions.epochs)

    const firstValidationIdx = trainSamples
    const validStoreBatchIdx = getStoreBatchIdx(
      firstValidationIdx,
      ds.train.storeBatchSize
    )
    const range = IDBKeyRange.lowerBound(validStoreBatchIdx)
    const validationData = validationSamples
      ? await getDbDataAsTensors(ds, "train", range)
      : undefined
    // const validationDataset = dataset.skip(trainSteps) <- slow

    const trainingPromise = model.fitDataset(trainDataset, {
      ...otherOptions,
      batchesPerEpoch: Math.ceil(trainSamples / batchSize),
      validationData,
    })

    useStore.setState({ trainingPromise })
    history = await trainingPromise?.then(() => {
      validationData?.[0].dispose()
      validationData?.[1].dispose()
    })
  }
  return history
}

async function getDbDataAsTensors(
  ds: Dataset,
  type: "train" | "test",
  range?: IDBKeyRange
) {
  const batches = await getAll<DbBatch>(ds.key, type, range)
  if (!batches.length) return
  const isClassification = ds.task === "classification"
  return tf.tidy(() => {
    const xBatchTensors = batches.map((b) => tf.tensor(b.xs))
    const shapeX = [-1, ...ds[type].shapeX.slice(1)] // -1 for unknown batch size
    const XRaw = tf.concat(xBatchTensors).reshape(shapeX)
    const X = ds.input?.preprocess?.(XRaw) ?? XRaw
    const yArr = batches.flatMap((b) => Array.from(b.ys))
    const y = isClassification
      ? tf.oneHot(yArr, ds.output.size)
      : tf.tensor(yArr)
    return [X, y] as const
  })
}

export async function trainOnBatch(xs: number[][], ys: number[]) {
  const ds = getDs()
  const setBatchCount = useStore.getState().setBatchCount
  const model = getModel()
  if (!ds || !model) return
  const isClassification = ds?.task === "classification"
  const trainShape = useStore.getState().getInputShape()
  const [X, y] = tf.tidy(() => {
    const X = tf.tensor(xs, [xs.length, ...trainShape.slice(1)]) // input already preprocessed
    const y = isClassification ? tf.oneHot(ys, ds.output.size) : tf.tensor(ys)
    return [X, y]
  })
  const [loss, acc] = (await model.trainOnBatch(X, y)) as number[]
  setBatchCount((prev) => prev + 1)
  X.dispose()
  y.dispose()
  return { loss, acc }
}

export async function getModelEvaluation() {
  const model = getModel()
  const ds = getDs()
  if (!ds || !model) return { loss: undefined, accuracy: undefined }

  const evData = await getDbDataAsTensors(ds, "test")
  if (!evData) return { loss: undefined, accuracy: undefined }
  const [X, y] = evData

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
