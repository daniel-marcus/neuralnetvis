import * as tf from "@tensorflow/tfjs"
import { getData } from "@/data/db"
import { getSingleOutput } from "./get-layer-activations"
import type { Dataset, DbBatch } from "@/data/types"

export interface TopSample {
  sampleIdx: number
  activation: number
  X: DbBatch["xs"] // raw input values of the sample
}

export interface TopSamplesOptions {
  k?: number
  maxSamples?: number // only the first samples of the subset are scanned
  shouldAbort?: () => boolean
  onProgress?: (progress: number, topSamples: TopSample[]) => void // progress: 0..1
}

/**
 * The samples of the dataset that activate a single neuron the most (output of the layer, as shown in the
 * scene). Reads one stored batch at a time, so that memory stays low and the scan can be aborted in between.
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
  const subModel = tf.model({ inputs: model.inputs, outputs: getSingleOutput(tfLayer) })
  let topSamples: TopSample[] = []
  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const batch = await getData<DbBatch>(ds.key, subset, batchIdx)
    if (shouldAbort?.()) return
    if (!batch) break
    const batchSize = batch.xs.length / valsPerSample
    const actTensor = tf.tidy(() => {
      const X = tf.tensor(batch.xs, [batchSize, ...ds.inputDims], "float32")
      const out = subModel.predict(ds.preprocess?.(X) ?? X, { batchSize }) as tf.Tensor
      return out.reshape([batchSize, -1]).gather([neuronIdx], 1).reshape([-1])
    })
    let activations: Float32Array
    try {
      activations = (await actTensor.data()) as Float32Array
    } finally {
      actTensor.dispose()
    }
    if (shouldAbort?.()) return
    const candidates: TopSample[] = []
    for (const [i, activation] of activations.entries()) {
      if (topSamples.length === k && activation <= topSamples[k - 1].activation) continue
      const sampleIdx = batchIdx * ds.storeBatchSize + i
      const X = batch.xs.slice(i * valsPerSample, (i + 1) * valsPerSample)
      candidates.push({ sampleIdx, activation, X })
    }
    if (candidates.length) {
      topSamples = [...topSamples, ...candidates]
        .toSorted((a, b) => b.activation - a.activation)
        .slice(0, k)
    }
    onProgress?.((batchIdx + 1) / numBatches, topSamples)
  }
  return topSamples
}
