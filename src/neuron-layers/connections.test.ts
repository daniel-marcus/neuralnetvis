import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getConv2DWeightIdx, getTopInputs } from "./connections"
import { getLayerWeights } from "@/model/weights"
import { getReceptiveFieldInputNids } from "@/model/layers/get-input-nids"
import type { NeuronLayer, NeuronStateful } from "./types"

function makeNeuron(
  layerType: string,
  tfLayer: tf.layers.Layer,
  prevTfLayer: tf.layers.Layer,
  inputNids: string[],
  weights?: number[],
) {
  const inputIdxs = Uint32Array.from(inputNids, (nid) => Number(nid.split("_")[1]))
  const prevLayer = { tfLayer: prevTfLayer } as NeuronLayer
  const layer = { layerType, tfLayer, prevLayer } as NeuronLayer
  return { layer, inputIdxs, weights } as NeuronStateful
}

describe("getTopInputs", () => {
  const input = tf.input({ shape: [4] })
  const dense = tf.layers.dense({ units: 1 })
  dense.apply(input)
  const inputNids = ["0_0", "0_1", "0_2", "0_3"]
  const prevTfLayer = { outputShape: [null, 4] } as tf.layers.Layer
  const neuron = makeNeuron("Dense", dense, prevTfLayer, inputNids, [1, -2, 0.5, 4])

  it("ranks by weighted input and keeps the sign", () => {
    const activations = new Float32Array([1, 2, 0, 0.5])
    const top = getTopInputs(neuron, activations)
    expect(top.map((t) => t.index)).toEqual([1, 3, 0]) // -4, 2, 1 (zero is skipped)
    expect(top.map((t) => t.strength)).toEqual([-1, 0.5, 0.25])
  })

  it("limits the number of inputs", () => {
    const activations = new Float32Array([1, 1, 1, 1])
    const top = getTopInputs(neuron, activations, 2)
    expect(top.map((t) => t.index)).toEqual([3, 1])
  })

  it("falls back to weights without activations", () => {
    const top = getTopInputs(neuron, undefined, 1)
    expect(top).toEqual([{ index: 3, strength: 1 }])
  })

  it("falls back to activations without weights", () => {
    const pooling = makeNeuron("MaxPooling2D", dense, prevTfLayer, inputNids)
    const top = getTopInputs(pooling, new Float32Array([0, 3, 1, 0]))
    expect(top.map((t) => t.index)).toEqual([1, 2])
  })

  it("shows all inputs if there is nothing to rank by", () => {
    const pooling = makeNeuron("MaxPooling2D", dense, prevTfLayer, inputNids)
    const top = getTopInputs(pooling)
    expect(top.map((t) => t.index)).toEqual([0, 1, 2, 3])
    expect(new Set(top.map((t) => t.strength)).size).toBe(1)
    expect(getTopInputs(pooling, undefined, 2).length).toBe(2)
  })

  it("always shows one-to-one connections", () => {
    const relu = makeNeuron("ReLU", dense, prevTfLayer, ["0_2"])
    expect(getTopInputs(relu, new Float32Array([1, 1, 0, 1]))).toEqual([{ index: 2, strength: 0 }])
    expect(getTopInputs(relu).map((t) => t.index)).toEqual([2])
  })
})

describe("getConv2DWeightIdx", () => {
  it("matches the weights of the receptive field", async () => {
    const [kernelHeight, kernelWidth, depth, filters] = [2, 3, 2, 2]
    const input = tf.input({ shape: [4, 5, depth] })
    const conv = tf.layers.conv2d({ filters, kernelSize: [kernelHeight, kernelWidth] })
    conv.apply(input)
    const kernelShape = [kernelHeight, kernelWidth, depth, filters]
    const kernel = tf.range(0, kernelHeight * kernelWidth * depth * filters).reshape(kernelShape)
    conv.setWeights([kernel, tf.zeros([filters])])
    const kernelArr = (await kernel.array()) as number[][][][]

    const filterIdx = 1
    const prevTfLayer = { outputShape: [null, 4, 5, depth] } as tf.layers.Layer
    const inputNids = getReceptiveFieldInputNids(conv, filterIdx, prevTfLayer, 0)
    const weights = getLayerWeights(conv).weights![filterIdx]
    expect(inputNids.length).toBe(weights.length)
    for (const [i, nid] of inputNids.entries()) {
      // output neuron [0, 0, filterIdx]: input index = (y * prevWidth + x) * depth + c
      const flatIdx = Number(nid.split("_")[1])
      const c = flatIdx % depth
      const x = Math.floor(flatIdx / depth) % 5
      const y = Math.floor(flatIdx / (depth * 5))
      const weightIdx = getConv2DWeightIdx(i, kernelHeight, kernelWidth, depth)
      expect(weights[weightIdx]).toBe(kernelArr[y][x][c][filterIdx])
    }
  })
})
