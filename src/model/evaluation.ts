import * as tf from "@tensorflow/tfjs"
import { getDs, getModel } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import { calculateRSquared } from "@/data/utils"
import type { Subset } from "@/store/data"
import type { Prediction } from "./types"
import { Dataset } from "@/data"

async function getEvalData(ds: Dataset, subset: Subset = "test") {
  return getDbDataAsTensors(ds, subset)
}

export async function getModelEvaluation(subset: Subset = "test") {
  const ds = getDs()
  if (!ds) return { loss: undefined, accuracy: undefined }
  const model = getModel()
  const data = await getEvalData(ds, subset)
  if (!model || !data) return { loss: undefined, accuracy: undefined }
  const { X, y } = data

  await tf.ready()
  const result = model.evaluate(X, y, { batchSize: 64 })
  const [lossT, accuracyT] = Array.isArray(result) ? result : [result]
  try {
    // TODO: allow other metrics
    const loss = await lossT.array()
    const accuracy = await accuracyT?.array()
    return { loss, accuracy }
  } catch (e) {
    console.warn(e)
    return { loss: undefined, accuracy: undefined }
  } finally {
    Object.values(data).forEach((t) => t?.dispose())
    lossT.dispose()
    accuracyT?.dispose()
  }
}

type PredictionResult = {
  predictions: Prediction[]
  rSquared?: number
}

export async function getPredictions(
  ds: Dataset,
  model: tf.LayersModel,
  subset: Subset = "test"
): Promise<PredictionResult | undefined> {
  // for regression only
  if (!ds) return
  const data = await getEvalData(ds, subset)
  if (!model || !data) return
  const { X, y } = data
  try {
    const result = tf.tidy(() => {
      const yTrueArr = y.arraySync() as number[]
      const yPred = (model.predict(X) as tf.Tensor).flatten()
      const yPredNorm = yPred.div(y.max()).arraySync() as number[]
      const predictions = yPred.arraySync().map((predicted, i) => ({
        actual: yTrueArr[i],
        predicted,
        normPredicted: yPredNorm[i],
      }))
      const rSquared =
        ds.task === "regression" ? calculateRSquared(y, yPred) : undefined
      return { predictions, rSquared }
    })
    return result
  } finally {
    Object.values(data).forEach((t) => t?.dispose())
  }
}
