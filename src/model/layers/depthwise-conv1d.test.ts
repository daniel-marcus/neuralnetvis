import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { getNid } from "@/neuron-layers/helpers"
import { DepthwiseConv1D, getConv1DInputNids } from "./depthwise-conv1d"
import { ZeroPadding1D } from "./zero-padding1d"
import { RMSNormalization } from "./rms-normalization"

const [steps, channels, kernelSize] = [5, 3, 3]
const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

describe("RMSNormalization", () => {
  it("should divide by the root mean square of the features and scale them", () => {
    const layer = RMSNormalization.constructorFunc({ axis: [-1], epsilon: 1e-5 })
    layer.build([null, steps, channels])
    const scale = tf.tensor1d([0.5, 2, -1])
    layer.setWeights([scale])
    const x = tf.randomNormal([2, steps, channels])
    const rms = x.square().mean(-1, true).add(1e-5).sqrt()
    expect(maxDiff(layer.apply(x) as tf.Tensor, x.div(rms).mul(scale))).toBeLessThan(1e-5)
  })

  it("should only support the last axis", () => {
    expect(() => RMSNormalization.constructorFunc({ axis: 1 })).toThrow("only axis -1")
  })
})

// y[t, c] = sum_j x[t + j, c] * kernel[j, c] (valid)
function reference(x: number[][], kernel: number[][]) {
  return x
    .slice(0, x.length - kernelSize + 1)
    .map((_, t) =>
      Array.from({ length: channels }, (__, c) =>
        kernel.reduce((sum, row, j) => sum + x[t + j][c] * row[c], 0),
      ),
    )
}

function createConv(causal: boolean) {
  const inp = input({ shape: [steps, channels] })
  const padded = causal
    ? (ZeroPadding1D.constructorFunc({ padding: [kernelSize - 1, 0] }).apply(inp) as SymbolicTensor)
    : inp
  const conv = DepthwiseConv1D.constructorFunc({ kernelSize: [kernelSize], useBias: false })
  const out = conv.apply(padded) as SymbolicTensor
  return { model: createModel({ inputs: inp, outputs: out }), conv }
}

describe("DepthwiseConv1D", () => {
  it("should convolve each channel separately (valid)", () => {
    const { model, conv } = createConv(false)
    const kernel = tf.randomNormal([kernelSize, channels, 1])
    conv.setWeights([kernel])
    const x = tf.randomNormal([1, steps, channels])
    const y = model.predict(x) as tf.Tensor
    expect(y.shape).toEqual([1, steps - kernelSize + 1, channels])
    const expected = reference(
      (x.arraySync() as number[][][])[0],
      kernel.squeeze([2]).arraySync() as number[][],
    )
    expect(maxDiff(y, tf.tensor3d([expected]))).toBeLessThan(1e-5)
  })

  it("should only see the previous positions after a causal ZeroPadding1D", () => {
    const { model, conv } = createConv(true)
    conv.setWeights([tf.randomNormal([kernelSize, channels, 1])])
    const x = tf.randomNormal([1, steps, channels])
    const changedLast = tf.concat(
      [x.slice([0, 0], [1, steps - 1]), tf.randomNormal([1, 1, channels])],
      1,
    )
    const [y, yChanged] = [x, changedLast].map((inp) => model.predict(inp) as tf.Tensor)
    expect(y.shape).toEqual([1, steps, channels])
    const before = (t: tf.Tensor) => t.slice([0, 0], [1, steps - 1])
    expect(maxDiff(before(y), before(yChanged))).toBe(0)
  })

  it("should connect each neuron to its channel at kernelSize positions", () => {
    const shape = (s: number) => ({ outputShape: [null, s, channels] }) as unknown as Layer
    const unpadded = shape(steps) // causal: ZeroPadding1D is invisible, the previous layer has `steps` positions
    const conv = Object.assign(shape(steps), { kernelSize }) as Layer
    const nIdx = 2 * channels + 1 // position 2, channel 1
    expect(getConv1DInputNids(conv, nIdx, unpadded, 7)).toEqual(
      [0, 1, 2].map((p) => getNid(7, p * channels + 1)),
    )
    // position 0: only itself (the padding has no neurons)
    expect(getConv1DInputNids(conv, 1, unpadded, 7)).toEqual([getNid(7, 1)])
    // valid convolution without padding: the positions t .. t + kernelSize - 1
    const valid = Object.assign(shape(steps - kernelSize + 1), { kernelSize }) as Layer
    expect(getConv1DInputNids(valid, 1, unpadded, 7)).toEqual(
      [0, 1, 2].map((p) => getNid(7, p * channels + 1)),
    )
  })
})
