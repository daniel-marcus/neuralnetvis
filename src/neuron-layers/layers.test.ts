import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { isVisible } from "./layers"

describe("isVisible", () => {
  const input = tf.input({ shape: [4] })
  const hiddenActivation = tf.layers.activation({ activation: "relu" })
  const outputActivation = tf.layers.activation({ activation: "softmax" })
  const x = hiddenActivation.apply(tf.layers.dense({ units: 3 }).apply(input)) as tf.SymbolicTensor
  tf.model({ inputs: input, outputs: outputActivation.apply(x) as tf.SymbolicTensor })

  it("hides invisible layer types like Activation", () => {
    expect(isVisible(hiddenActivation)).toBe(false)
  })

  it("always shows the output layer", () => {
    // e.g. the softmax after a tied ReversibleEmbedding, see import-keras.ts
    expect(isVisible(outputActivation)).toBe(true)
  })
})
