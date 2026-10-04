import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getDsFromDef, loadAndSaveDsData } from "./dataset"
import { getSample } from "./sample"
import { getSamplesAsBatch } from "@/model/training"
import { getAll } from "./db"
import { fetchMultipleNpzWithProgress } from "./npy-loader"
import { tweets } from "./datasets/tweets"
import type { DbBatch } from "./types"

describe("loadAndSaveDsData", () => {
  it("stores sequence targets (ys with multiple values per sample) with their samples", async () => {
    await loadAndSaveDsData(tweets, true)
    const batches = await getAll<DbBatch>(tweets.key, "train")
    const [xTrain, yTrain] = await fetchMultipleNpzWithProgress(
      ["/data/tweets/x_train_preview.npz", "/data/tweets/y_train_preview.npz"],
      true,
    )
    const [numSamples, length] = yTrain.shape
    const storedXs = batches.flatMap((b) => Array.from(b.xs))
    const storedYs = batches.flatMap((b) => Array.from(b.ys))
    expect(storedXs).toEqual(Array.from(xTrain.data))
    expect(storedYs).toEqual(Array.from(yTrain.data))
    expect(storedYs).toHaveLength(numSamples * length)
  })
})

describe("next token prediction (tweets)", () => {
  it("provides token sequences as targets and the vocabulary as output labels", async () => {
    const ds = await getDsFromDef(tweets, true)
    expect(ds.outputLabels).toHaveLength(10000)
    expect(ds.outputLabels.slice(0, 5)).toEqual(["<PAD>", "<START>", "<OOV>", "<END>", "i"])

    const { xs, ys } = await getSamplesAsBatch(ds, 16, 1)
    expect(xs.shape).toEqual([16, 32])
    expect(ys.shape).toEqual([16, 32, 1])
    // ys are xs shifted by one token
    const [x, y] = [xs.arraySync() as number[][], ys.squeeze([2]).arraySync() as number[][]]
    expect(y[0].slice(0, -1)).toEqual(x[0].slice(1))

    // sample target: next token at the last word = <END>
    const sample = await getSample(ds, "train", 16)
    expect(sample?.y).toBe(ds.tokenizer!.encodeDict["<END>"])
  })
})

describe("next token prediction (tweets) training", () => {
  it("trains a model with sequence outputs on the stored data", async () => {
    const ds = await getDsFromDef(tweets, true)
    const vocabSize = ds.outputLabels.length
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: vocabSize, outputDim: 4, inputLength: 32 }),
        tf.layers.dense({ units: vocabSize, activation: "softmax" }),
      ],
    })
    model.compile({
      optimizer: "adam",
      loss: "sparseCategoricalCrossentropy",
      metrics: ["accuracy"],
    })
    const { xs, ys } = await getSamplesAsBatch(ds, 8, 0)
    const history = await model.fit(xs, ys, { epochs: 2, verbose: 0 })
    expect(history.history.loss.every((l) => Number.isFinite(l as number))).toBe(true)
    expect(history.history.acc).toHaveLength(2)
  })
})
