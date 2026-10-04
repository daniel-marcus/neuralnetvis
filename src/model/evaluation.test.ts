import { describe, it, expect, beforeAll } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getEvaluation } from "./evaluation"
import { getDbDataAsTensors, getDsFromDef, loadAndSaveDsData } from "@/data/dataset"
import { dsMnistMock } from "@/data/datasets/_mocks"
import { autoMpg } from "@/data/datasets/auto-mpg"
import { tweets } from "@/data/datasets/tweets"
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

  describe("nextToken", () => {
    it("computes loss, accuracy and top-5 accuracy per predicted word", async () => {
      const ds = await getDsFromDef(tweets, true) // preview: 100 train samples
      const vocabSize = ds.outputLabels.length
      const data = await getDbDataAsTensors(ds, "train")
      if (!data) throw new Error("No train data")
      const yTrue = data.y.dataSync()
      const { "<PAD>": pad, "<OOV>": oov } = ds.tokenizer!.encodeDict

      // unigram model: predicts the word frequencies of the targets (without <PAD> and <OOV>),
      // so that accuracy and top-5 accuracy are not ~0 as with random weights
      const counts = new Float32Array(vocabSize)
      yTrue.forEach((t) => t !== pad && t !== oov && counts[t]++)
      const model = tf.sequential({
        layers: [
          tf.layers.embedding({ inputDim: vocabSize, outputDim: 8, inputLength: 32 }),
          tf.layers.dense({ units: vocabSize, activation: "softmax" }),
        ],
      })
      model.layers[1].setWeights([tf.zeros([8, vocabSize]), tf.tensor(counts).add(1).log()])

      const evaluation = await getEvaluation(ds, model, "train", true)

      // reference: plain loops over all positions, skipping <PAD> and <OOV> targets
      const probs = (model.predict(data.X) as tf.Tensor).dataSync() as Float32Array
      let [lossSum, correct, correctTop5, count] = [0, 0, 0, 0]
      for (let i = 0; i < yTrue.length; i++) {
        const target = yTrue[i]
        if (target === pad || target === oov) continue
        const row = probs.subarray(i * vocabSize, (i + 1) * vocabSize)
        const pTarget = row[target]
        const numHigher = row.reduce((n, p) => (p > pTarget ? n + 1 : n), 0)
        lossSum -= Math.log(Math.min(Math.max(pTarget, 1e-7), 1 - 1e-7))
        if (numHigher === 0) correct++
        if (numHigher < 5) correctTop5++
        count++
      }
      expect(count).toBeLessThan(yTrue.length) // padding is excluded
      expect(correct).toBeGreaterThan(0)
      expect(correctTop5).toBeGreaterThan(correct)
      expect(evaluation.loss).toBeCloseTo(lossSum / count, 4)
      expect(evaluation.perplexity).toBeCloseTo(Math.exp(lossSum / count), 2)
      expect(evaluation.accuracy).toBeCloseTo(correct / count, 6)
      expect(evaluation.topKAccuracy).toBeCloseTo(correctTop5 / count, 6)
    })
  })
})
