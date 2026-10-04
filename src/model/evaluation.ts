import * as tf from "@tensorflow/tfjs"
import { clearStatus, getDs, getModel, setStatus } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import type { Subset } from "@/store/data"
import type { Evaluation, Prediction } from "./types"
import type { Dataset } from "@/data"

const BATCH_SIZE = 128
const NEXT_TOKEN_BATCH_SIZE = 16 // predictions are [batch, seqLen, vocabSize], e.g. 16 * 32 * 10k floats
const TOP_K = 5 // = number of next word suggestions (TextArea)
const EPSILON = 1e-7 // clipping as in tfjs' categoricalCrossentropy

/**
 * Single forward pass over the subset: loss, accuracy / R² and per-sample predictions.
 * Loss matches the compiled loss (categoricalCrossentropy or meanSquaredError).
 * nextToken: loss, accuracy and top-5 accuracy per predicted word, see getNextTokenEvaluation
 */
export async function getEvaluation(
  ds: Dataset,
  model: tf.LayersModel,
  subset: Subset = "test",
  silent = false,
): Promise<Evaluation> {
  const data = await getDbDataAsTensors(ds, subset, { noOneHot: true })
  if (!data) return {}
  const statusId = silent ? undefined : setStatus("Evaluating ...", 0)
  const onProgress = (percent: number) => {
    if (statusId) setStatus("Evaluating ...", percent, { id: statusId })
  }
  try {
    if (ds.task === "nextToken") return await getNextTokenEvaluation(ds, model, data, onProgress)
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

/**
 * Next token prediction: mean over the predicted words, i.e. targets other than <PAD> and <OOV>
 * (as in ml-notebooks/tweets.py with sample_weight). Accumulated batch by batch on the backend,
 * because all predictions (samples * seqLen * vocabSize) wouldn't fit into memory.
 */
async function getNextTokenEvaluation(
  ds: Dataset,
  model: tf.LayersModel,
  data: { X: tf.Tensor; y: tf.Tensor },
  onProgress?: (percent: number) => void,
): Promise<Evaluation> {
  const encodeDict = ds.tokenizer?.encodeDict ?? {}
  const ignoredTokens = ["<PAD>", "<OOV>"].map((t) => encodeDict[t]).filter((t) => t !== undefined)
  const numSamples = data.X.shape[0]
  let [lossSum, correct, correctTopK, count] = [0, 0, 0, 0]
  for (let start = 0; start < numSamples; start += NEXT_TOKEN_BATCH_SIZE) {
    const size = Math.min(NEXT_TOKEN_BATCH_SIZE, numSamples - start)
    const sums = tf.tidy(() => {
      const probs = model.predict(data.X.slice(start, size)) as tf.Tensor // [size, seqLen, vocabSize]
      const vocabSize = probs.shape[probs.shape.length - 1]!
      const flatProbs = probs.reshape([-1, vocabSize])
      const yTrue = data.y.slice(start, size).flatten().toInt()
      const mask = ignoredTokens
        .reduce((m, t) => m.logicalAnd(yTrue.notEqual(t)), tf.onesLike(yTrue).cast("bool"))
        .toFloat()
      const pTrue = tf.gather(flatProbs, yTrue.expandDims(1), 1, 1).squeeze([1])
      const losses = pTrue
        .clipByValue(EPSILON, 1 - EPSILON)
        .log()
        .neg()
      const isCorrect = flatProbs.argMax(1).equal(yTrue).toFloat()
      const { indices } = tf.topk(flatProbs, TOP_K)
      const isInTopK = indices.equal(yTrue.expandDims(1)).any(1).toFloat()
      return tf.stack([
        losses.mul(mask).sum(),
        isCorrect.mul(mask).sum(),
        isInTopK.mul(mask).sum(),
        mask.sum(),
      ])
    })
    try {
      const [batchLoss, batchCorrect, batchCorrectTopK, batchCount] = await sums.data()
      lossSum += batchLoss
      correct += batchCorrect
      correctTopK += batchCorrectTopK
      count += batchCount
    } finally {
      sums.dispose()
    }
    onProgress?.((start + size) / numSamples)
  }
  if (!count) return {}
  const loss = lossSum / count
  return {
    loss,
    perplexity: Math.exp(loss),
    accuracy: correct / count,
    topKAccuracy: correctTopK / count,
  }
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
