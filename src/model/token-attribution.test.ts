import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getTokenAttribution } from "./token-attribution"
import type { TokenizerType } from "@/data/tokenizer"

// toy sentiment model: token 4 = "good" (positive), token 5 = "bad" (negative), all others neutral
function toyModel() {
  const input = tf.input({ shape: [6] })
  const embedding = tf.layers.embedding({ inputDim: 6, outputDim: 1 })
  const pooling = tf.layers.globalAveragePooling1d()
  const dense = tf.layers.dense({ units: 2, activation: "softmax" })
  const output = dense.apply(pooling.apply(embedding.apply(input))) as tf.SymbolicTensor
  const model = tf.model({ inputs: input, outputs: output })
  embedding.setWeights([tf.tensor2d([[0], [0], [0], [0], [6], [-3]])])
  dense.setWeights([tf.tensor2d([[-1, 1]]), tf.zeros([2])])
  return model
}

const tokenizer = {
  encodeDict: { "<PAD>": 0, "<START>": 1, "<OOV>": 2 },
} as unknown as TokenizerType

describe("getTokenAttribution", () => {
  const model = toyModel()
  const tokens = [1, 4, 3, 5, 0, 0] // <START> good neutral bad <PAD> <PAD>
  const xTensor = tf.tensor2d([tokens], [1, 6], "int32")
  const attribution = Array.from(getTokenAttribution(model, xTensor, tokens, tokenizer).dataSync())

  it("is positive for tokens that support the predicted class", () => {
    expect(attribution[1]).toBeCloseTo(1) // largest impact = 1
  })

  it("is negative for tokens that argue against the predicted class", () => {
    expect(attribution[3]).toBeLessThan(0)
    expect(attribution[3]).toBeGreaterThan(-1)
  })

  it("is zero for neutral and padding tokens", () => {
    expect(attribution[2]).toBeCloseTo(0)
    expect(attribution.slice(4)).toEqual([0, 0])
  })
})
