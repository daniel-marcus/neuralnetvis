import { describe, it, expect } from "vitest"
import { loadAndSaveDsData } from "./dataset"
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
