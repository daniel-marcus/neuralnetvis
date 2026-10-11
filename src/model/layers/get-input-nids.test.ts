import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { getReceptiveFieldInputNids, getReceptiveFieldOrigin } from "./get-input-nids"

type Padding = "same" | "valid"

// returns the [y, x] positions of the inputs of the output neuron [y, x, 0]
function getInputPositions(
  l: tf.layers.Layer,
  inputSize: number,
  y: number,
  x: number,
  depthwise?: boolean,
) {
  const prevTfLayer = { outputShape: [null, inputSize, inputSize, 1] } as tf.layers.Layer
  const [, , outWidth, outDepth] = l.outputShape as number[]
  const nIdx = (y * outWidth + x) * outDepth
  const nids = getReceptiveFieldInputNids(l, nIdx, prevTfLayer, 0, depthwise)
  const positions = nids.map((nid) => {
    const idx = Number(nid.split("_")[1])
    return [Math.floor(idx / inputSize), idx % inputSize]
  })
  return { positions, origin: getReceptiveFieldOrigin(l, nIdx, prevTfLayer) }
}

function makeConv(inputSize: number, kernelSize: number, padding: Padding, strides = 1) {
  const conv = tf.layers.conv2d({ filters: 2, kernelSize, padding, strides })
  conv.apply(tf.input({ shape: [inputSize, inputSize, 1] }))
  return conv
}

function makePool(padding: Padding) {
  const pool = tf.layers.maxPooling2d({ poolSize: 2, padding })
  pool.apply(tf.input({ shape: [5, 5, 1] }))
  return pool
}

describe("getReceptiveFieldInputNids", () => {
  it("is anchored at the neuron with valid padding", () => {
    const conv = makeConv(5, 3, "valid")
    const { positions, origin } = getInputPositions(conv, 5, 2, 2) // last neuron (output: 3x3)
    expect(origin).toEqual([2, 2])
    expect(positions.length).toBe(9)
    expect(positions[0]).toEqual([2, 2])
    expect(positions[8]).toEqual([4, 4])
  })

  it("is centered on the neuron with same padding", () => {
    const conv = makeConv(5, 3, "same")
    const { positions, origin } = getInputPositions(conv, 5, 2, 2)
    expect(origin).toEqual([1, 1])
    expect(positions.length).toBe(9)
    expect(positions[0]).toEqual([1, 1])
    expect(positions[8]).toEqual([3, 3])
  })

  it("skips inputs outside of the previous layer instead of wrapping", () => {
    const conv = makeConv(5, 3, "same")
    // last neuron in the first row
    const corner = getInputPositions(conv, 5, 0, 4)
    expect(corner.origin).toEqual([-1, 3])
    expect(corner.positions).toEqual([
      [0, 3],
      [0, 4],
      [1, 3],
      [1, 4],
    ])
    // last row
    const edge = getInputPositions(conv, 5, 4, 2)
    expect(edge.positions).toEqual([
      [3, 1],
      [3, 2],
      [3, 3],
      [4, 1],
      [4, 2],
      [4, 3],
    ])
  })

  it("pads the odd cell at the end with strides", () => {
    // in: 4, out: 2, total padding: 1 -> nothing before, 1 after
    const conv = makeConv(4, 3, "same", 2)
    expect(getInputPositions(conv, 4, 0, 0).origin).toEqual([0, 0])
    const last = getInputPositions(conv, 4, 1, 1)
    expect(last.origin).toEqual([2, 2])
    expect(last.positions).toEqual([
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ])
  })

  it("honors the padding of pooling layers", () => {
    const valid = getInputPositions(makePool("valid"), 5, 1, 1, true) // output: 2x2
    expect(valid.positions).toEqual([
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ])
    const same = getInputPositions(makePool("same"), 5, 2, 2, true) // output: 3x3
    expect(same.positions).toEqual([[4, 4]])
  })
})
