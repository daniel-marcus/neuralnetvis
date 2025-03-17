import { describe, it, expect, beforeAll } from "vitest"
import { getSamplesAsBatch, TensorBatch } from "./training"
import { dsMnistMock } from "@/data/datasets/_mocks"
import { getSample } from "@/data/sample"
import * as tf from "@tensorflow/tfjs"

describe("getSamplesAsBatch", () => {
  let result: TensorBatch | undefined
  const newBatchSize = 128

  describe("classification", () => {
    beforeAll(async () => {
      result = await getSamplesAsBatch(dsMnistMock, newBatchSize, 2)
      if (!result) throw new Error("No result")
    })

    it("should return correctly reshaped TensorBatch", async () => {
      const shapeX = [newBatchSize, ...dsMnistMock.inputDims]
      const shapeY = [newBatchSize, dsMnistMock.outputLabels.length]
      expect(result?.xs.shape).toEqual(shapeX)
      expect(result?.ys.shape).toEqual(shapeY)
    })

    it("should return correct samples (test first)", async () => {
      const firstFromBatchData = result?.xs
        .slice(0, 1)
        .flatten()
        .arraySync() as number[]
      const firstFromBatchLabel = result?.ys.slice(0, 1).arraySync() as number[]
      const sample256 = await getSample(dsMnistMock, "train", 256)
      if (!sample256) throw new Error("No sample")
      const sample256Data = tf.tidy(() => {
        const tensor = tf.tensor(sample256.X).flatten()
        const preprocessed = dsMnistMock.preprocess?.(tensor) ?? tensor
        return preprocessed.arraySync() as number[]
      })
      const sample256Label = tf.tidy(
        () =>
          tf
            .oneHot(sample256.y!, dsMnistMock.outputLabels.length)
            .arraySync() as number[]
      )
      expect(firstFromBatchData).toEqual(sample256Data)
      expect(firstFromBatchLabel[0]).toEqual(sample256Label)
    })

    result?.xs.dispose()
    result?.ys.dispose()
  })
})
