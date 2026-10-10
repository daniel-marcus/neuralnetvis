import * as tf from "@tensorflow/tfjs"
import { getData } from "@/data/db"
import { getSingleOutput } from "./get-layer-activations"
import { getFilter, getLayerInput, getWeightedInput, hasWeightedInput } from "./feature-vis"
import type { Dataset, DbBatch } from "@/data/types"

export interface TopSample {
  sampleIdx: number
  value: number // weighted input (Conv2D, Dense) or activation of the neuron
  X: DbBatch["xs"] // raw input values of the sample
}

export interface TopSamplesOptions {
  k?: number
  maxSamples?: number // only the first samples of the subset are scanned
  shouldAbort?: () => boolean
  onProgress?: (progress: number, topSamples: TopSample[]) => void // progress: 0..1
}

/**
 * The samples of the dataset that activate a single neuron the most. Conv2D and Dense neurons are ranked by
 * their weighted input (before the activation function): activations have many ties, e.g. softmax saturates
 * at 1 and ReLU at 0, so the first samples would win. Other layers are ranked by their output.
 * Reads one stored batch at a time, so that memory stays low and the scan can be aborted in between.
 * Returns undefined if aborted.
 */
export async function getTopSamples(
  model: tf.LayersModel,
  tfLayer: tf.layers.Layer,
  neuronIdx: number,
  ds: Dataset,
  subset: "train" | "test",
  { k = 9, maxSamples = 20_000, shouldAbort, onProgress }: TopSamplesOptions = {},
): Promise<TopSample[] | undefined> {
  const totalSamples = Math.min(ds[subset].totalSamples, maxSamples)
  const numBatches = Math.ceil(totalSamples / ds.storeBatchSize)
  const valsPerSample = ds.inputDims.reduce((a, b) => a * b)
  const getValues = getNeuronValues(model, tfLayer, neuronIdx)
  let topSamples: TopSample[] = []
  try {
    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
      const batch = await getData<DbBatch>(ds.key, subset, batchIdx)
      if (shouldAbort?.()) return
      if (!batch) break
      const batchSize = batch.xs.length / valsPerSample
      const valuesTensor = tf.tidy(() => {
        const X = tf.tensor(batch.xs, [batchSize, ...ds.inputDims], "float32")
        return getValues(ds.preprocess?.(X) ?? X)
      })
      let values: Float32Array
      try {
        values = (await valuesTensor.data()) as Float32Array
      } finally {
        valuesTensor.dispose()
      }
      if (shouldAbort?.()) return
      const candidates: TopSample[] = []
      for (const [i, value] of values.entries()) {
        if (topSamples.length === k && value <= topSamples[k - 1].value) continue
        const sampleIdx = batchIdx * ds.storeBatchSize + i
        const X = batch.xs.slice(i * valsPerSample, (i + 1) * valsPerSample)
        candidates.push({ sampleIdx, value, X })
      }
      if (candidates.length) {
        topSamples = [...topSamples, ...candidates]
          .toSorted((a, b) => b.value - a.value)
          .slice(0, k)
      }
      onProgress?.((batchIdx + 1) / numBatches, topSamples)
    }
    return topSamples
  } finally {
    getValues.dispose()
  }
}

const predict = (model: tf.LayersModel, X: tf.Tensor) =>
  model.predict(X, { batchSize: X.shape[0] }) as tf.Tensor

// value of the neuron for each sample of a (preprocessed) batch: [batch]
function getNeuronValues(model: tf.LayersModel, tfLayer: tf.layers.Layer, neuronIdx: number) {
  if (!hasWeightedInput(tfLayer)) {
    const subModel = tf.model({ inputs: model.inputs, outputs: getSingleOutput(tfLayer) })
    const getValues = (X: tf.Tensor) =>
      predict(subModel, X).reshape([X.shape[0], -1]).gather([neuronIdx], 1).reshape([-1])
    return Object.assign(getValues, { dispose: () => {} })
  }
  const layerInput = getLayerInput(tfLayer)
  const isFirstLayer = layerInput.sourceLayer.getClassName() === "InputLayer"
  const head = isFirstLayer ? undefined : tf.model({ inputs: model.inputs, outputs: layerInput })
  const filter = tf.keep(getFilter(tfLayer, neuronIdx))
  const getValues = (X: tf.Tensor) =>
    getWeightedInput(tfLayer, neuronIdx, filter, head ? predict(head, X) : X)
  return Object.assign(getValues, { dispose: () => filter.dispose() })
}
