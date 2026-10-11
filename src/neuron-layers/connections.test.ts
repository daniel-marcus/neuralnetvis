import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getConv2DWeightIdx, getInputRegions, getTopInputs, getWeightedInputs } from "./connections"
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

  it("returns the weighted inputs in the order of the weights", () => {
    const activations = new Float32Array([1, 2, 0, 0.5])
    expect(getWeightedInputs(neuron, activations)).toEqual([1, -4, 0, 2])
    const pooling = makeNeuron("MaxPooling2D", dense, prevTfLayer, inputNids)
    expect(getWeightedInputs(pooling, activations)).toBeUndefined()
  })

  it("ranks other input layers without the weights", () => {
    // e.g. the 2nd input of Add: the weights belong to the first input
    const otherIdxs = Uint32Array.of(0, 1, 2, 3)
    const top = getTopInputs(neuron, new Float32Array([0, 1, -2, 0]), undefined, otherIdxs)
    expect(top).toEqual([
      { index: 2, strength: -1 },
      { index: 1, strength: 0.5 },
    ])
    expect(getTopInputs(neuron, undefined, 2, otherIdxs).map((t) => t.index)).toEqual([0, 1])
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
    for (const nid of inputNids) {
      // output neuron [0, 0, filterIdx]: input index = (y * prevWidth + x) * depth + c
      const flatIdx = Number(nid.split("_")[1])
      const c = flatIdx % depth
      const x = Math.floor(flatIdx / depth) % 5
      const y = Math.floor(flatIdx / (depth * 5))
      const weightIdx = getConv2DWeightIdx(y, x, c, kernelHeight, kernelWidth)
      expect(weights[weightIdx]).toBe(kernelArr[y][x][c][filterIdx])
    }
  })
})

const sum = (values: number[]) => values.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0)

describe("getTopInputs (Conv2D with same padding)", () => {
  const [size, depth, filters] = [4, 2, 2]
  const input = tf.input({ shape: [size, size, depth] })
  const conv = tf.layers.conv2d({ filters, kernelSize: 3, padding: "same" })
  conv.apply(input)
  const kernel = tf.range(1, 3 * 3 * depth * filters + 1).reshape([3, 3, depth, filters])
  conv.setWeights([kernel, tf.zeros([filters])])
  const prevTfLayer = { outputShape: [null, size, size, depth] } as tf.layers.Layer
  const getNeuron = (y: number, x: number, filterIdx: number) => {
    const index = (y * size + x) * filters + filterIdx
    const inputNids = getReceptiveFieldInputNids(conv, index, prevTfLayer, 0)
    const weights = getLayerWeights(conv).weights![filterIdx]
    return { ...makeNeuron("Conv2D", conv, prevTfLayer, inputNids, weights), index }
  }

  it("uses the weights of the kernel positions inside of the previous layer", async () => {
    const kernelArr = (await kernel.array()) as number[][][][]
    const filterIdx = 1
    // last neuron in the first row: the field starts at [-1, 2]
    const top = getTopInputs(getNeuron(0, size - 1, filterIdx))
    expect(top.length).toBe(2 * 2 * depth)
    const maxWeight = kernelArr[2][1][depth - 1][filterIdx] // largest weight inside
    for (const { index, strength } of top) {
      const c = index % depth
      const x = Math.floor(index / depth) % size
      const y = Math.floor(index / (depth * size))
      expect(x).toBeGreaterThanOrEqual(size - 2)
      expect(y).toBeLessThanOrEqual(1)
      expect(strength).toBeCloseTo(kernelArr[y + 1][x - 2][c][filterIdx] / maxWeight)
    }
  })

  it("returns weighted inputs that add up to the activation", async () => {
    const x = tf.randomNormal([1, size, size, depth])
    const out = (await (conv.apply(x) as tf.Tensor).array()) as number[][][][]
    const prevActivations = await x.data()
    for (const [y, xPos, filterIdx] of [
      [1, 1, 0], // full kernel
      [0, size - 1, 1], // corner: kernel positions outside of the previous layer are NaN
    ]) {
      const weightedInputs = getWeightedInputs(getNeuron(y, xPos, filterIdx), prevActivations)!
      expect(weightedInputs.length).toBe(3 * 3 * depth)
      expect(sum(weightedInputs)).toBeCloseTo(out[0][y][xPos][filterIdx], 3)
    }
    const corner = getWeightedInputs(getNeuron(0, size - 1, 1), prevActivations)!
    expect(corner.filter(Number.isNaN).length).toBe(3 * 3 * depth - 2 * 2 * depth)
  })

  it("uses the full kernel in the center", () => {
    const top = getTopInputs(getNeuron(1, 1, 0))
    expect(top.length).toBe(3 * 3 * depth)
    expect(top[0]).toEqual({ index: (2 * size + 2) * depth + 1, strength: 1 }) // kernel [2, 2, 1]
  })
})

const toIdxs = (nids: string[]) => nids.map((nid) => Number(nid.split("_")[1]))

describe("getInputRegions", () => {
  const [size, depth] = [4, 3]
  const prevShape = [null, size, size, depth] as unknown as number[]
  const prevTfLayer = { outputShape: prevShape } as tf.layers.Layer
  const input = tf.input({ shape: [size, size, depth] })

  it("returns the receptive field in every channel of the previous layer", () => {
    const conv = tf.layers.conv2d({ filters: 2, kernelSize: 2 })
    conv.apply(input)
    const inputNids = getReceptiveFieldInputNids(conv, 0, prevTfLayer, 0)
    const regions = getInputRegions(toIdxs(inputNids), prevShape)
    expect(regions.length).toBe(depth)
    for (const [channelIdx, region] of regions.entries()) {
      const positions = region.map((idx) => Math.floor(idx / depth))
      expect(positions).toEqual([0, 1, size, size + 1]) // [0, 0], [0, 1], [1, 0], [1, 1]
      expect(region.every((idx) => idx % depth === channelIdx)).toBe(true)
    }
  })

  it("returns one region for inputs from a single channel", () => {
    const pooling = tf.layers.maxPooling2d({ poolSize: 2 })
    pooling.apply(input)
    const neuronIdx = 1 // channel 1
    const inputNids = getReceptiveFieldInputNids(pooling, neuronIdx, prevTfLayer, 0, true)
    const regions = getInputRegions(toIdxs(inputNids), prevShape)
    expect(regions).toEqual([[1, depth + 1, size * depth + 1, (size + 1) * depth + 1]])
  })

  it("returns one region for layers without channels", () => {
    expect(getInputRegions(Uint32Array.of(0, 1, 2, 3), [-1, 4])).toEqual([[0, 1, 2, 3]])
    expect(getInputRegions(Uint32Array.of(2), [-1, 4])).toEqual([[2]])
    expect(getInputRegions(new Uint32Array(), [-1, 4])).toEqual([])
  })
})
