import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { addTrainData, getDsFromDef, loadAndSaveDsData, resetData } from "./dataset"
import { getSample } from "./sample"
import { getSamplesAsBatch } from "@/model/training"
import { getAll } from "./db"
import { fetchMultipleNpzWithProgress } from "./npy-loader"
import { tweets } from "./datasets/tweets"
import type { Dataset, DatasetDef, DbBatch, StoreMeta } from "./types"
import { getData } from "./db"

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

describe("addTrainData", () => {
  it("appends to a partly filled last batch without losing its samples", async () => {
    const dsDef = { ...tweets, key: "append_test", inputDims: [2], storeBatchSize: 3 } as DatasetDef
    await resetData(dsDef.key, "train")
    const add = (from: number, n: number) => {
      const xs = Float32Array.from({ length: n * 2 }, (_, i) => from * 2 + i)
      const ys = Float32Array.from({ length: n }, (_, i) => from + i)
      return addTrainData(dsDef, { data: xs, shape: [n, 2] }, { data: ys, shape: [n] })
    }
    await add(0, 2) // batch 0: 2 of 3
    await add(2, 1) // batch 0 full
    await add(3, 4) // batch 1 full, batch 2: 1 of 3
    await add(7, 1)

    const batches = await getAll<DbBatch>(dsDef.key, "train")
    expect(batches.map((b) => b.index)).toEqual([0, 1, 2])
    expect(batches.flatMap((b) => Array.from(b.ys))).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(batches.flatMap((b) => Array.from(b.xs))).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    )
    const meta = await getData<StoreMeta>(dsDef.key, "meta", "train")
    expect(meta?.totalSamples).toBe(8)
  })

  it("updates the samples cached by getSample", async () => {
    const dsDef = { ...tweets, key: "cache_test", inputDims: [2], storeBatchSize: 3 } as DatasetDef
    const ds = { ...dsDef, task: "classification", storeBatchSize: 3 } as Dataset
    const add = (values: number[]) =>
      addTrainData(
        dsDef,
        { data: Float32Array.from(values), shape: [1, 2] },
        { data: Float32Array.from([0]), shape: [1] },
      )
    await resetData(dsDef.key, "train")
    await add([1, 2])
    expect((await getSample(ds, "train", 0))?.X).toEqual([1, 2]) // caches batch 0
    await add([3, 4]) // appended to batch 0
    expect((await getSample(ds, "train", 1))?.X).toEqual([3, 4])

    await resetData(dsDef.key, "train")
    await add([5, 6])
    expect((await getSample(ds, "train", 0))?.X).toEqual([5, 6])
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
