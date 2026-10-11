import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getInputTfLayers, isVisible } from "./layers"

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

const apply = (layer: tf.layers.Layer, x: tf.SymbolicTensor | tf.SymbolicTensor[]) =>
  layer.apply(x) as tf.SymbolicTensor

describe("getInputTfLayers", () => {
  const input = tf.input({ shape: [4, 4, 2] })
  const conv1 = tf.layers.conv2d({ filters: 2, kernelSize: 3, padding: "same" })
  const dropout = tf.layers.dropout({ rate: 0.5 })
  const conv2 = tf.layers.conv2d({ filters: 2, kernelSize: 3, padding: "same" })
  const add = tf.layers.add()
  const flatten = tf.layers.flatten()
  const dense = tf.layers.dense({ units: 3 })
  const skip = apply(conv1, input)
  const branch = apply(conv2, apply(dropout, skip))
  const output = apply(dense, apply(flatten, apply(add, [skip, branch])))
  const model = tf.model({ inputs: input, outputs: output })

  it("returns all inputs of a layer in their order", () => {
    expect(getInputTfLayers(add)).toEqual([conv1, conv2])
  })

  it("skips invisible layers", () => {
    expect(getInputTfLayers(conv2)).toEqual([conv1]) // through Dropout
    expect(getInputTfLayers(dense)).toEqual([add]) // through Flatten
  })

  it("returns no inputs for the input layer", () => {
    expect(getInputTfLayers(model.layers[0])).toEqual([])
    expect(getInputTfLayers(conv1)).toEqual([model.layers[0]])
  })
})
