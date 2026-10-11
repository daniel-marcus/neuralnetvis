import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getLayerWeights, getNeuronWeights } from "./weights"

describe("getNeuronWeights", () => {
  it("reads single neurons of large kernels in the same order as getLayerWeights", () => {
    const conv = tf.layers.conv2d({ filters: 1200, kernelSize: [3, 3] })
    conv.apply(tf.input({ shape: [8, 8, 100] })) // kernel: 3 * 3 * 100 * 1200 > 1M weights
    const { weights, biases } = getLayerWeights(conv)
    for (const idx of [0, 7, 1199]) {
      const neuron = getNeuronWeights(conv, idx)
      expect(neuron.weights).toEqual(weights![idx])
      expect(neuron.bias).toBe(biases![idx])
    }
  })
})
