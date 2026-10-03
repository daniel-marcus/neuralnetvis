import { describe, it, expect, beforeAll } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getEvaluation } from "./evaluation"
import { getDbDataAsTensors, loadAndSaveDsData } from "@/data/dataset"
import { dsMnistMock } from "@/data/datasets/_mocks"
import { autoMpg } from "@/data/datasets/auto-mpg"
import type { Dataset, PreprocessFunc } from "@/data/types"

const scale255 = ((x) => x.div(255)) as PreprocessFunc

describe("getEvaluation", () => {
  describe("classification", () => {
    const ds: Dataset = { ...dsMnistMock, preprocess: scale255 }
    const model = tf.sequential({
      layers: [
        tf.layers.flatten({ inputShape: ds.inputDims }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({ units: ds.outputLabels.length, activation: "softmax" }),
      ],
    })
    model.compile({ optimizer: "adam", loss: "categoricalCrossentropy", metrics: ["accuracy"] })

    it("matches model.evaluate and model.predict", async () => {
      const evaluation = await getEvaluation(ds, model, "test", true)
      const data = await getDbDataAsTensors(ds, "test")
      if (!data) throw new Error("No test data")
      const [loss, accuracy] = (model.evaluate(data.X, data.y) as tf.Scalar[]).map(
        (t) => t.dataSync()[0],
      )
      const predicted = Array.from((model.predict(data.X) as tf.Tensor).argMax(1).dataSync())
      const actual = Array.from(data.y.argMax(1).dataSync())

      expect(evaluation.loss).toBeCloseTo(loss, 4)
      expect(evaluation.accuracy).toBeCloseTo(accuracy, 6)
      expect(evaluation.predictions?.map((p) => p.predicted)).toEqual(predicted)
      expect(evaluation.predictions?.map((p) => p.actual)).toEqual(actual)
    })
  })

  describe("regression", () => {
    const ds = autoMpg as Dataset
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: ds.inputDims, units: 8, activation: "relu" }),
        tf.layers.dense({ units: 1 }),
      ],
    })
    model.compile({ optimizer: "adam", loss: "meanSquaredError" })

    beforeAll(async () => {
      await loadAndSaveDsData(autoMpg, true) // only has loadPreview (complete dataset)
    })

    it("matches model.evaluate and computes R²", async () => {
      const evaluation = await getEvaluation(ds, model, "test", true)
      const data = await getDbDataAsTensors(ds, "test")
      if (!data) throw new Error("No test data")
      const loss = (model.evaluate(data.X, data.y) as tf.Scalar).dataSync()[0]
      const yPred = (model.predict(data.X) as tf.Tensor).flatten()
      const yTrue = data.y.flatten()
      const rSquared = tf
        .scalar(1)
        .sub(yTrue.sub(yPred).square().sum().div(yTrue.sub(yTrue.mean()).square().sum()))
        .dataSync()[0]

      expect(evaluation.loss).toBeCloseTo(loss, 2)
      expect(evaluation.rSquared).toBeCloseTo(rSquared, 4)
      expect(evaluation.predictions?.map((p) => p.predicted)).toEqual(Array.from(yPred.dataSync()))
    })
  })
})
