import * as tf from "@tensorflow/tfjs"
import { clearStatus, getDs, getModel, setStatus } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import type { Subset } from "@/store/data"
import type { Evaluation, Prediction } from "./types"
import type { Dataset } from "@/data"

const BATCH_SIZE = 128
const EPSILON = 1e-7 // clipping as in tfjs' categoricalCrossentropy

/**
 * Single forward pass over the subset: loss, accuracy / R² and per-sample predictions.
 * Loss matches the compiled loss (categoricalCrossentropy or meanSquaredError).
 */
export async function getEvaluation(
  ds: Dataset,
  model: tf.LayersModel,
  subset: Subset = "test",
  silent = false,
): Promise<Evaluation> {
  // TODO: evaluation for next token prediction (masked accuracy, top-5 accuracy, perplexity)
  if (ds.task === "nextToken") return {}
  const data = await getDbDataAsTensors(ds, subset, { noOneHot: true })
  if (!data) return {}
  const statusId = silent ? undefined : setStatus("Evaluating ...", 0)
  const onProgress = (percent: number) => {
    if (statusId) setStatus("Evaluating ...", percent, { id: statusId })
  }
  try {
    const yTrue = await data.y.data()
    const yPred = await predictBatched(model, data.X, onProgress)
    return ds.task === "classification"
      ? getClassificationEvaluation(yTrue, yPred, ds.outputLabels.length)
      : getRegressionEvaluation(yTrue, yPred)
  } finally {
    if (statusId) clearStatus(statusId)
    Object.values(data).forEach((t) => t?.dispose())
  }
}

export async function getModelEvaluation(subset: Subset = "test") {
  const ds = getDs()
  const model = getModel()
  if (!ds || !model) return { loss: undefined, accuracy: undefined }
  const { loss, accuracy } = await getEvaluation(ds, model, subset, true)
  return { loss, accuracy }
}

async function predictBatched(
  model: tf.LayersModel,
  X: tf.Tensor,
  onProgress?: (percent: number) => void,
) {
  // batched and async, so that the main thread stays responsive
  const numSamples = X.shape[0]
  let result = new Float32Array(0)
  for (let start = 0; start < numSamples; start += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, numSamples - start)
    const batchPred = tf.tidy(() => model.predict(X.slice(start, size)) as tf.Tensor)
    try {
      const values = await batchPred.data()
      if (start === 0) result = new Float32Array(numSamples * (values.length / size))
      result.set(values, start * (values.length / size))
    } finally {
      batchPred.dispose()
    }
    onProgress?.((start + size) / numSamples)
  }
  return result
}

function getClassificationEvaluation(
  yTrue: ArrayLike<number>,
  probs: Float32Array,
  numClasses: number,
): Evaluation {
  const maxActual = getMax(yTrue)
  const predictions: Prediction[] = []
  let lossSum = 0
  let correct = 0
  for (let i = 0; i < yTrue.length; i++) {
    const row = probs.subarray(i * numClasses, (i + 1) * numClasses)
    const actual = yTrue[i]
    const predicted = row.indexOf(Math.max(...row))
    const rowSum = row.reduce((a, b) => a + b, 0)
    const pActual = Math.min(Math.max(row[actual] / rowSum, EPSILON), 1 - EPSILON)
    lossSum -= Math.log(pActual)
    if (predicted === actual) correct++
    predictions.push({ actual, predicted, normPredicted: predicted / maxActual })
  }
  const n = yTrue.length
  return { loss: lossSum / n, accuracy: correct / n, predictions }
}

function getRegressionEvaluation(yTrue: ArrayLike<number>, yPred: Float32Array): Evaluation {
  const n = yTrue.length
  const maxActual = getMax(yTrue)
  const meanActual = Array.from(yTrue).reduce((a, b) => a + b, 0) / n
  let residualSumSquares = 0
  let totalSumSquares = 0
  const predictions: Prediction[] = []
  for (let i = 0; i < n; i++) {
    const actual = yTrue[i]
    const predicted = yPred[i]
    residualSumSquares += (actual - predicted) ** 2
    totalSumSquares += (actual - meanActual) ** 2
    predictions.push({ actual, predicted, normPredicted: predicted / maxActual })
  }
  return {
    loss: residualSumSquares / n, // meanSquaredError
    rSquared: 1 - residualSumSquares / totalSumSquares,
    predictions,
  }
}

function getMax(values: ArrayLike<number>) {
  let max = -Infinity
  for (let i = 0; i < values.length; i++) max = Math.max(max, values[i])
  return max
}
