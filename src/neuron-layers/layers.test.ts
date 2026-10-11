import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getPrevVisibleTfLayer, isVisible } from "./layers"

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

describe("getPrevVisibleTfLayer", () => {
  it("skips invisible layers in sequential models", () => {
    const conv = tf.layers.conv2d({ filters: 2, kernelSize: 3, inputShape: [8, 8, 1] })
    const flatten = tf.layers.flatten()
    const dense = tf.layers.dense({ units: 4 })
    tf.sequential({ layers: [conv, flatten, dense] })
    expect(getPrevVisibleTfLayer(dense)).toBe(conv)
    const inputLayer = getPrevVisibleTfLayer(conv) // implicit, not in model.layers
    expect(inputLayer?.getClassName()).toBe("InputLayer")
    expect(inputLayer?.batchInputShape).toEqual([null, 8, 8, 1])
  })

  it("follows the graph in functional models", () => {
    const input = tf.input({ shape: [4] })
    const hidden = tf.layers.dense({ units: 3 })
    const relu = tf.layers.activation({ activation: "relu" })
    const output = tf.layers.dense({ units: 2 })
    const x = relu.apply(hidden.apply(input)) as tf.SymbolicTensor
    const model = tf.model({ inputs: input, outputs: output.apply(x) as tf.SymbolicTensor })
    expect(getPrevVisibleTfLayer(output)).toBe(hidden)
    expect(getPrevVisibleTfLayer(hidden)).toBe(model.layers[0])
    expect(getPrevVisibleTfLayer(model.layers[0])).toBeUndefined()
  })
})
