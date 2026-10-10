import { describe, it, expect, vi } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getTopSamples } from "./top-samples"
import type { Dataset, DbBatch } from "@/data/types"

const [numSamples, storeBatchSize, inputDim] = [25, 10, 4]

// sample i = [i, 0, 0, 0] for even i, [-i, 0, 0, 0] for odd i
const batches: DbBatch[] = Array.from(
  { length: Math.ceil(numSamples / storeBatchSize) },
  (_, b) => {
    const size = Math.min(storeBatchSize, numSamples - b * storeBatchSize)
    const xs = new Float32Array(size * inputDim)
    for (let i = 0; i < size; i++) {
      const idx = b * storeBatchSize + i
      xs[i * inputDim] = idx % 2 === 0 ? idx : -idx
    }
    return { index: b, xs, ys: new Uint8Array(size) }
  },
)

vi.mock("@/data/db", () => ({
  getData: vi.fn(async (_db: string, _store: string, key: number) => batches[key]),
}))

function createModel() {
  const model = tf.sequential()
  model.add(tf.layers.dense({ units: 2, inputShape: [inputDim], useBias: false }))
  // neuron 0 = first input value, neuron 1 = its negative
  model.layers[0].setWeights([tf.tensor2d([1, -1, 0, 0, 0, 0, 0, 0], [inputDim, 2])])
  return model
}

const ds = {
  key: "test",
  inputDims: [inputDim],
  storeBatchSize,
  train: { index: "train", totalSamples: numSamples },
  test: { index: "test", totalSamples: 0 },
} as unknown as Dataset

describe("getTopSamples", () => {
  const model = createModel()
  const layer = model.layers[0]

  it("returns the samples with the highest activations across batches", async () => {
    const top = await getTopSamples(model, layer, 0, ds, "train", { k: 3 })
    expect(top!.map((s) => s.sampleIdx)).toEqual([24, 22, 20])
    expect(top!.map((s) => s.value)).toEqual([24, 22, 20])
    expect(Array.from(top![0].X)).toEqual([24, 0, 0, 0])
  })

  it("selects the neuron by its index", async () => {
    const top = await getTopSamples(model, layer, 1, ds, "train", { k: 2 })
    expect(top!.map((s) => s.sampleIdx)).toEqual([23, 21])
  })

  it("only scans the first maxSamples", async () => {
    const top = await getTopSamples(model, layer, 0, ds, "train", { k: 2, maxSamples: 10 })
    expect(top!.map((s) => s.sampleIdx)).toEqual([8, 6])
  })

  it("reports progress and can be aborted", async () => {
    const progress: number[] = []
    let aborted = false
    const top = await getTopSamples(model, layer, 0, ds, "train", {
      onProgress: (p) => {
        progress.push(p)
        aborted = true
      },
      shouldAbort: () => aborted,
    })
    expect(top).toBeUndefined()
    expect(progress).toEqual([1 / 3])
  })

  it("doesn't leak tensors", async () => {
    const before = tf.memory().numTensors
    await getTopSamples(model, layer, 0, ds, "train")
    await getTopSamples(model, layer, 0, ds, "train", { shouldAbort: () => true })
    expect(tf.memory().numTensors).toBe(before)
  })

  it("ranks saturated softmax outputs by their weighted input", async () => {
    const softmax = tf.sequential()
    softmax.add(
      tf.layers.dense({ units: 2, inputShape: [inputDim], useBias: false, activation: "softmax" }),
    )
    softmax.layers[0].setWeights([tf.tensor2d([10, -10, 0, 0, 0, 0, 0, 0], [inputDim, 2])])
    const probs = softmax.predict(tf.tensor2d([[2, 0, 0, 0]])) as tf.Tensor
    expect(probs.dataSync()[0]).toBe(1) // ties: almost all even samples have a probability of exactly 1
    const top = await getTopSamples(softmax, softmax.layers[0], 0, ds, "train", { k: 3 })
    expect(top!.map((s) => s.sampleIdx)).toEqual([24, 22, 20])
  })

  it("ranks other layers by their output", async () => {
    const withRelu = tf.sequential()
    withRelu.add(tf.layers.dense({ units: 2, inputShape: [inputDim], useBias: false }))
    withRelu.add(tf.layers.reLU())
    withRelu.layers[0].setWeights([tf.tensor2d([1, -1, 0, 0, 0, 0, 0, 0], [inputDim, 2])])
    const top = await getTopSamples(withRelu, withRelu.layers[1], 1, ds, "train", { k: 2 })
    expect(top!.map((s) => s.sampleIdx)).toEqual([23, 21])
    expect(top!.map((s) => s.value)).toEqual([23, 21])
  })
})
